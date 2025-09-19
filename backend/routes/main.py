from flask import Blueprint, jsonify, request, current_app, g
from datetime import datetime
from functools import wraps
from fhir.resources.valueset import ValueSet
from fhir.resources.codesystem import CodeSystem
from fhir.resources.conceptmap import ConceptMap
from fhir.resources.bundle import Bundle
from fhir.resources.operationoutcome import OperationOutcome
from fhir.resources.coding import Coding
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.parameters import Parameters, ParametersParameter
from ..services.database import get_connection
import re

main_bp = Blueprint("main", __name__)

# ==================== MOCK OAUTH 2.0 SECURITY ====================
def mock_oauth_required(f):
    """Decorator to mock OAuth 2.0 authentication with ABHA token."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            outcome = make_operation_outcome("error", "security", "Authentication required. Missing 'Authorization' header.")
            return jsonify(outcome.dict()), 401, {'Content-Type': 'application/fhir+json'}
        
        if not auth_header.startswith('Bearer '):
            outcome = make_operation_outcome("error", "security", "Invalid token format. Expected 'Bearer <token>'.")
            return jsonify(outcome.dict()), 401, {'Content-Type': 'application/fhir+json'}
        
        mock_token = auth_header[7:]
        if not re.match(r'^\d{14}$', mock_token):
            outcome = make_operation_outcome("error", "security", "Invalid token. Token must be a 14-digit ABHA number.")
            return jsonify(outcome.dict()), 401, {'Content-Type': 'application/fhir+json'}
        
        g.user_id = mock_token
        g.scopes = ["patient/Problem.read", "patient/Problem.write"]
        
        return f(*args, **kwargs)
    return decorated_function

# ==================== ICD-11 VALIDATION HELPERS ====================
def is_valid_icd11_stem_code(code: str) -> bool:
    """Validates if an ICD-11 code is a valid stem code for morbidity reporting."""
    if not code:
        return False
    
    if code.startswith('TM2-'):
        return True

    icd11_stem_pattern = r'^[A-Za-z]\d{1,4}(\.\d{1,2})?$'
    if re.match(icd11_stem_pattern, code) and not any(c in code for c in ['/', '*', '†']):
        return True
        
    return False

def validate_icd11_coding(coding: dict) -> OperationOutcome or None:
    """Validates a FHIR Coding object for ICD-11 compliance."""
    if coding.get('system') != 'http://id.who.int/icd/release/11':
        return None
    
    code = coding.get('code')
    if not code:
        return make_operation_outcome("error", "value", "ICD-11 coding requires a 'code'.")
    
    if not is_valid_icd11_stem_code(code):
        return make_operation_outcome("error", "value", f"ICD-11 code '{code}' is not a valid stem code for morbidity reporting.")
    
    return None

# ==================== FHIR & MAPPING HELPER FUNCTIONS ====================
def make_operation_outcome(severity: str, code: str, details: str):
    """Create a FHIR OperationOutcome for errors."""
    outcome = OperationOutcome.construct()
    issue = {
        "severity": severity,
        "code": code,
        "details": {"text": details}
    }
    outcome.issue = [issue]
    return outcome

def create_fhir_coding(system: str, code: str, display: str):
    """Helper to create a FHIR Coding."""
    return Coding.construct({
        "system": system,
        "code": code,
        "display": display
    })

def determine_mapping_case(mappings):
    """Determine which of the 4 mapping cases applies."""
    if not mappings:
        return "no_mapping"
    
    mapping_types = [m['mapping_type'] for m in mappings]
    
    if 'TM2' in mapping_types and 'Biomed' in mapping_types:
        return "case_3_dual_match"
    if 'TM2' in mapping_types:
        return "case_1_tm2_only"
    if 'Biomed' in mapping_types:
        return "case_2_biomed_only"
    if 'TM2-fallback' in mapping_types:
        return "case_4_fallback"
    
    return "unknown"

def calculate_confidence_score(mappings):
    """Calculate confidence score 0.0-1.0 based on mapping quality."""
    if not mappings:
        return 0.0
    
    scores = {'TM2': 0.9, 'Biomed': 0.95, 'TM2-fallback': 0.6}
    return max(scores.get(m['mapping_type'], 0.5) for m in mappings)

def get_recommended_codes(mappings, mapping_case):
    """Get recommended codes for different use cases."""
    tm2 = [m for m in mappings if m['mapping_type'] == 'TM2']
    biomed = [m for m in mappings if m['mapping_type'] == 'Biomed']
    fallback = [m for m in mappings if m['mapping_type'] == 'TM2-fallback']
    
    recommendations = {}
    
    if mapping_case == "case_1_tm2_only":
        recommendations['primary'] = tm2[0] if tm2 else None
        recommendations['for_insurance'] = tm2[0] if tm2 else None
        
    elif mapping_case == "case_2_biomed_only":
        recommendations['primary'] = biomed[0] if biomed else None
        recommendations['for_insurance'] = biomed[0] if biomed else None
        
    elif mapping_case == "case_3_dual_match":
        recommendations['for_traditional_context'] = tm2[0] if tm2 else None
        recommendations['for_modern_context'] = biomed[0] if biomed else None
        recommendations['for_insurance'] = biomed[0] if biomed else None
        
    elif mapping_case == "case_4_fallback":
        recommendations['primary'] = fallback[0] if fallback else None
        recommendations['requires_validation'] = True
        
    return recommendations

# ==================== FHIR TERMINOLOGY ENDPOINTS ====================
@main_bp.route("/CodeSystem/namaste", methods=["GET"])

def get_namaste_codesystem():
    """FHIR Endpoint: Exposes the NAMASTE codes as a FHIR CodeSystem resource."""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT code, display_name, category FROM namaste_codes")
        concepts = []
        for row in cursor:
            concept_dict = {
                "code": row['code'],
                "display": row['display_name'],
                "designation": [{
                    "use": {
                        "system": "http://terminology.hl7.org/CodeSystem/designation-usage",
                        "code": "display"
                    },
                    "value": row['display_name']
                }]
            }
            if row['category']:
                concept_dict['property'] = [{
                    "code": "category",
                    "valueString": row['category']
                }]
            concepts.append(concept_dict)

        cursor.close()
        conn.close()

        cs = CodeSystem.construct()
        cs.url = "http://example.org/CodeSystem/namaste-codes"
        cs.name = "NAMASTECodeSystem"
        cs.title = "National AYUSH Morbidity & Standardized Terminologies Electronic (NAMASTE) Codes"
        cs.status = "active"
        cs.content = "complete"
        cs.concept = concepts

        return jsonify(cs.dict()), 200, {'Content-Type': 'application/fhir+json'}

    except Exception as e:
        outcome = make_operation_outcome("error", "exception", f"Failed to get CodeSystem: {str(e)}")
        return jsonify(outcome.dict()), 500, {'Content-Type': 'application/fhir+json'}

@main_bp.route("/ConceptMap/namaste-to-icd11", methods=["GET"])
@mock_oauth_required
def get_namaste_icd11_conceptmap():
    """FHIR Endpoint: Mapping from NAMASTE to ICD-11 (TM2 & Biomed) as a FHIR ConceptMap."""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        sql = """
        SELECT n.code as source_code, n.display_name as source_display,
               m.icd11_code as target_code, m.icd11_display_name as target_display,
               m.mapping_type
        FROM icd11_mappings m
        JOIN namaste_codes n ON m.namaste_code = n.code
        ORDER BY n.code
        """
        cursor.execute(sql)
        mappings = cursor.fetchall()
        cursor.close()
        conn.close()

        cm = ConceptMap.construct()
        cm.url = "http://example.org/ConceptMap/namaste-to-icd11"
        cm.name = "NAMASTEToICD11Map"
        cm.title = "Mapping from NAMASTE Codes to ICD-11 (TM2 and Biomedicine)"
        cm.status = "active"

        group_dict = {
            "source": "http://example.org/CodeSystem/namaste-codes",
            "target": "http://id.who.int/icd/release/11",
            "element": []
        }
        for map_row in mappings:
            element_dict = {
                "code": map_row['source_code'],
                "display": map_row['source_display'],
                "target": [{
                    "code": map_row['target_code'],
                    "display": map_row['target_display'],
                    "equivalence": "equivalent",
                    "comment": f"Mapping Type: {map_row['mapping_type']}"
                }]
            }
            group_dict["element"].append(element_dict)

        cm.group = [group_dict]

        return jsonify(cm.dict()), 200, {'Content-Type': 'application/fhir+json'}

    except Exception as e:
        outcome = make_operation_outcome("error", "exception", f"Failed to get ConceptMap: {str(e)}")
        return jsonify(outcome.dict()), 500, {'Content-Type': 'application/fhir+json'}

@main_bp.route("/ValueSet/$expand", methods=["GET"])
@mock_oauth_required
def expand_valueset():
    """FHIR Terminology Endpoint: Auto-complete value-set lookup."""
    filter_text = request.args.get("filter", "").strip().lower()
    if not filter_text or len(filter_text) < 2:
        vs = ValueSet.construct()
        vs.expansion = {"total": 0, "contains": []}
        return jsonify(vs.dict()), 200, {'Content-Type': 'application/fhir+json'}

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        search_sql = """
        SELECT code, display_name, category FROM namaste_codes
        WHERE MATCH(display_name, category) AGAINST (%s IN NATURAL LANGUAGE MODE)
        OR display_name LIKE %s
        LIMIT 20
        """
        search_pattern = f"%{filter_text}%"
        cursor.execute(search_sql, (filter_text, search_pattern))
        conditions = cursor.fetchall()

        expansion_contains = []
        for condition in conditions:
            mapping_sql = """
            SELECT icd11_code, icd11_display_name, mapping_type
            FROM icd11_mappings WHERE namaste_code = %s
            """
            cursor.execute(mapping_sql, (condition['code'],))
            mappings = cursor.fetchall()

            concept = CodeableConcept.construct()
            concept.coding = []

            namaste_coding = create_fhir_coding(
                system="http://example.org/CodeSystem/namaste-codes",
                code=condition['code'],
                display=condition['display_name']
            )
            concept.coding.append(namaste_coding)

            for map_row in mappings:
                icd11_coding = create_fhir_coding(
                    system="http://id.who.int/icd/release/11",
                    code=map_row['icd11_code'],
                    display=map_row['icd11_display_name']
                )
                concept.coding.append(icd11_coding)

            expansion_contains.append({
                "system": "http://example.org/CodeSystem/namaste-codes",
                "code": condition['code'],
                "display": condition['display_name'],
                "contains": [{
                    "system": coding.system,
                    "code": coding.code,
                    "display": coding.display
                } for coding in concept.coding]
            })

        cursor.close()
        conn.close()

        vs = ValueSet.construct()
        vs.url = request.args.get("url", "")
        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)

            sql = """
            SELECT n.code as source_code, n.display_name as source_display,
                   m.icd11_code as target_code, m.icd11_display_name as target_display,
                   m.mapping_type
            FROM icd11_mappings m
            JOIN namaste_codes n ON m.namaste_code = n.code
            ORDER BY n.code
            """
            cursor.execute(sql)
            mappings = cursor.fetchall()
            cursor.close()
            conn.close()

            cm = ConceptMap.construct()
            cm.url = "http://example.org/ConceptMap/namaste-to-icd11"
            cm.name = "NAMASTEToICD11Map"
            cm.title = "Mapping from NAMASTE Codes to ICD-11 (TM2 and Biomedicine)"
            cm.status = "active"

            group = ConceptMap.construct().group or []
            # Create a new group as a dictionary
            group_dict = {
                "source": "http://example.org/CodeSystem/namaste-codes",
                "target": "http://id.who.int/icd/release/11",
                "element": []
            }
            for map_row in mappings:
                element_dict = {
                    "code": map_row['source_code'],
                    "display": map_row['source_display'],
                    "target": [{
                        "code": map_row['target_code'],
                        "display": map_row['target_display'],
                        "equivalence": "equivalent",
                        "comment": f"Mapping Type: {map_row['mapping_type']}"
                    }]
                }
                group_dict["element"].append(element_dict)

            cm.group = [group_dict]

            return jsonify(cm.dict()), 200, {'Content-Type': 'application/fhir+json'}

        except Exception as e:
            outcome = make_operation_outcome("error", "exception", f"Failed to get ConceptMap: {str(e)}")
            return jsonify(outcome.dict()), 500, {'Content-Type': 'application/fhir+json'}
        cursor.close()
        conn.close()

        response_params = {
            "resourceType": "Parameters",
            "parameter": [{
                "name": "result",
                "valueBoolean": len(results) > 0
            }, {
                "name": "message",
                "valueString": f"Found {len(results)} mappings." if results else "No mapping found."
            }]
        }

        for match in results:
            response_params["parameter"].append({
                "name": "match",
                "part": [
                    {"name": "equivalence", "valueCode": "equivalent"},
                    {"name": "concept", "valueCoding": {
                        "system": target_system,
                        "code": match['icd11_code'] if target_system == "http://id.who.int/icd/release/11" else match['code'],
                        "display": match['icd11_display_name'] if target_system == "http://id.who.int/icd/release/11" else match['display_name']
                    }}
                ]
            })

        return jsonify(response_params), 200, {'Content-Type': 'application/fhir+json'}

    except Exception as e:
        outcome = make_operation_outcome("error", "exception", f"Translation failed: {str(e)}")
        return jsonify(outcome.dict()), 500, {'Content-Type': 'application/fhir+json'}

# ==================== FHIR BUNDLE UPLOAD ====================
@main_bp.route("/", methods=["POST"])
@mock_oauth_required
def upload_bundle():
    """FHIR Endpoint: Secure FHIR Bundle upload interface for double-coded encounters."""
    try:
        bundle_data = request.get_json()
        bundle = Bundle(**bundle_data)

        validation_errors = []
        if bundle.entry:
            for entry in bundle.entry:
                if entry.resource and entry.resource.resource_type == "Condition":
                    for coding in entry.resource.code.coding:
                        error = validate_icd11_coding(coding.dict())
                        if error:
                            validation_errors.append(f"Entry {entry.fullUrl}: {error.issue[0].details.text}")

        if validation_errors:
            outcome = OperationOutcome.construct()
            outcome.issue = []
            for error_msg in validation_errors:
                issue = {
                    "severity": "error",
                    "code": "invalid",
                    "details": {"text": error_msg}
                }
                outcome.issue.append(issue)
            return jsonify(outcome.dict()), 422, {'Content-Type': 'application/fhir+json'}

        current_app.logger.info(f"User {g.user_id} uploaded a valid Bundle of type: {bundle.type} with {len(bundle.entry or [])} entries.")

        outcome = OperationOutcome.construct()
        outcome.issue = [{
            "severity": "information",
            "code": "informational",
            "details": {"text": f"Bundle received and validated successfully. Processed {len(bundle.entry or [])} entries."}
        }]
        outcome.meta = {
            "extension": [{
                "url": "http://example.org/fhir/StructureDefinition/audit-event",
                "valueString": f"user:{g.user_id}|action:create|resource:Bundle|status:success"
            }]
        }
        return jsonify(outcome.dict()), 200, {'Content-Type': 'application/fhir+json'} 

    except Exception as e:
        outcome = make_operation_outcome("error", "invalid", f"Failed to process Bundle: {str(e)}")
        return jsonify(outcome.dict()), 400, {'Content-Type': 'application/fhir+json'}

# ==================== NON-FHIR ENDPOINTS (For Demo & Stats) ====================
@main_bp.route("/search/conditions", methods=["GET"])
@mock_oauth_required
def search_conditions():
    """Search NAMASTE conditions with intelligent mapping detection."""
    try:
        query = request.args.get("q", "").strip()
        limit = min(int(request.args.get("limit", 10)), 50)
        page = max(int(request.args.get("page", 1)), 1)
        offset = (page - 1) * limit

        if not query or len(query) < 2:
            return jsonify({"error": "Query parameter 'q' required (min 2 characters)"}), 400

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        search_sql = """
        SELECT * FROM namaste_codes 
        WHERE MATCH(display_name, category) AGAINST (%s IN NATURAL LANGUAGE MODE)
        OR code LIKE %s 
        OR display_name LIKE %s
        LIMIT %s OFFSET %s
        """
        
        search_pattern = f"%{query}%"
        cursor.execute(search_sql, (query, search_pattern, search_pattern, limit, offset))
        conditions = cursor.fetchall()

        results = []
        for condition in conditions:
            mapping_sql = """
            SELECT * FROM icd11_mappings 
            WHERE namaste_code = %s 
            ORDER BY CASE mapping_type 
                WHEN 'TM2' THEN 1 WHEN 'Biomed' THEN 2 WHEN 'TM2-fallback' THEN 3 ELSE 4 END
            """
            cursor.execute(mapping_sql, (condition['code'],))
            mappings = cursor.fetchall()
            
            mapping_case = determine_mapping_case(mappings)
            
            results.append({
                "id": condition['id'],
                "code": condition['code'],
                "display_name": condition['display_name'],
                "category": condition['category'],
                "mappings": mappings,
                "mapping_case": mapping_case,
                "confidence_score": calculate_confidence_score(mappings),
                "has_biomed_mapping": any(m['mapping_type'] == 'Biomed' for m in mappings),
                "has_tm2_mapping": any(m['mapping_type'] == 'TM2' for m in mappings)
            })

        count_sql = """
        SELECT COUNT(*) as total FROM namaste_codes 
        WHERE MATCH(display_name, category) AGAINST (%s IN NATURAL LANGUAGE MODE)
        OR code LIKE %s OR display_name LIKE %s
        """
        cursor.execute(count_sql, (query, search_pattern, search_pattern))
        total = cursor.fetchone()['total']

        cursor.close()
        conn.close()

        return jsonify({
            "results": results,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            },
            "query": query
        })

    except Exception as e:
        return jsonify({"error": f"Search failed: {str(e)}"}), 500

@main_bp.route("/mapping-profile/<string:namaste_code>", methods=["GET"])
@mock_oauth_required
def get_mapping_profile(namaste_code):
    """Get complete mapping profile for a NAMASTE code."""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        condition_sql = "SELECT * FROM namaste_codes WHERE code = %s"
        cursor.execute(condition_sql, (namaste_code,))
        condition = cursor.fetchone()
        
        if not condition:
            return jsonify({"error": f"NAMASTE code '{namaste_code}' not found"}), 404

        mappings_sql = "SELECT * FROM icd11_mappings WHERE namaste_code = %s ORDER BY mapping_type"
        cursor.execute(mappings_sql, (namaste_code,))
        mappings = cursor.fetchall()
        
        mapping_case = determine_mapping_case(mappings)
        confidence = calculate_confidence_score(mappings)
        recommendations = get_recommended_codes(mappings, mapping_case)

        cursor.close()
        conn.close()

        return jsonify({
            "condition": {
                "id": condition['id'],
                "code": condition['code'],
                "display_name": condition['display_name'],
                "category": condition['category'],
                "system": condition.get('system', 'NAMASTE')
            },
            "mappings": mappings,
            "mapping_analysis": {
                "case": mapping_case,
                "confidence_score": confidence,
                "total_mappings": len(mappings),
                "has_biomed_mapping": any(m['mapping_type'] == 'Biomed' for m in mappings),
                "has_tm2_mapping": any(m['mapping_type'] == 'TM2' for m in mappings)
            },
            "recommendations": recommendations
        })

    except Exception as e:
        return jsonify({"error": f"Failed to get mapping profile: {str(e)}"}), 500

@main_bp.route("/mapping-stats", methods=["GET"])
@mock_oauth_required
def get_mapping_stats():
    """Get statistics about mapping coverage and distribution."""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
        SELECT mapping_type, COUNT(*) as count 
        FROM icd11_mappings 
        GROUP BY mapping_type ORDER BY count DESC
        """)
        mapping_stats = cursor.fetchall()

        cursor.execute("""
        SELECT 
            COUNT(DISTINCT n.code) as total_conditions,
            COUNT(DISTINCT m.namaste_code) as mapped_conditions,
            COUNT(DISTINCT n.code) - COUNT(DISTINCT m.namaste_code) as unmapped_conditions,
            ROUND((COUNT(DISTINCT m.namaste_code) / COUNT(DISTINCT n.code)) * 100, 2) as coverage_percentage
        FROM namaste_codes n
        LEFT JOIN icd11_mappings m ON n.code = m.namaste_code
        """)
        coverage_stats = cursor.fetchone()

        cursor.execute("""
        SELECT namaste_code, COUNT(*) as mapping_count
        FROM icd11_mappings 
        GROUP BY namaste_code 
        HAVING COUNT(*) > 1
        ORDER BY mapping_count DESC
        LIMIT 10
        """)
        multi_mapped = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "mapping_type_distribution": mapping_stats,
            "coverage_statistics": coverage_stats,
            "multi_mapped_conditions": multi_mapped,
            "last_updated": datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({"error": f"Failed to get statistics: {str(e)}"}), 500

@main_bp.route("/health", methods=["GET"])
def health_check():
    """Comprehensive health check endpoint."""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT NOW() as server_time, DATABASE() as db_name, VERSION() as mysql_version")
        db_info = cursor.fetchone()
        
        cursor.execute("""
        SELECT 
            (SELECT COUNT(*) FROM namaste_codes) as namaste_count,
            (SELECT COUNT(*) FROM icd11_mappings) as mappings_count,
            (SELECT COUNT(*) FROM encounters) as encounters_count,
            (SELECT COUNT(*) FROM encounter_problems) as problems_count
        """)
        counts = cursor.fetchone()
        
        cursor.close()
        conn.close()

        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": {
                "connected": True,
                "name": db_info['db_name'],
                "server_time": db_info['server_time'].isoformat() if hasattr(db_info['server_time'], 'isoformat') else str(db_info['server_time']),
                "version": db_info['mysql_version']
            },
            "records": {
                "namaste_conditions": counts['namaste_count'],
                "icd11_mappings": counts['mappings_count'],
                "encounters": counts['encounters_count'],
                "problems": counts['problems_count']
            }
        })
        
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }), 500

@main_bp.route("/mapping-cases", methods=["GET"])
def get_mapping_cases():
    """Get documentation for the 4 mapping cases."""
    cases = {
        "case_1_tm2_only": {
            "name": "NAMASTE ↔ ICD-11 TM2 Only",
            "description": "Traditional medicine concepts without direct biomedical equivalent",
            "example": {"namaste": "NAM001 - Agnimandya", "icd11": "TM2-11001 - Digestive disorder due to imbalance"},
            "when_to_use": "For conditions unique to traditional medicine systems",
            "confidence": "High (0.9)"
        },
        "case_2_biomed_only": {
            "name": "NAMASTE ↔ ICD-11 Biomed Only", 
            "description": "Conditions with direct biomedical equivalents",
            "example": {"namaste": "NAM002 - Prameha", "icd11": "5A11 - Type 2 Diabetes Mellitus"},
            "when_to_use": "For conditions recognized in modern medicine",
            "confidence": "Very High (0.95)"
        },
        "case_3_dual_match": {
            "name": "NAMASTE ↔ ICD-11 TM2 + Biomed",
            "description": "Conditions with both traditional and biomedical mappings",
            "example": {"namaste": "NAM003 - Tamaka Shwasa", "icd11": ["TM2-22010 - Respiratory disorder", "CA40 - Asthma"]},
            "when_to_use": "For comprehensive coverage in both systems",
            "confidence": "Very High (0.95)"
        },
        "case_4_fallback": {
            "name": "NAMASTE → ICD-11 TM2 Fallback",
            "description": "Conditions without specific mapping, using broad categories",
            "example": {"namaste": "NAM004 - Vataja Gulma", "icd11": "TM2-19999 - Digestive disorder (unspecified)"},
            "when_to_use": "When no direct mapping exists, requires validation",
            "confidence": "Medium (0.6)"
        }
    }
    
    return jsonify({"mapping_cases": cases})

@main_bp.route("/", methods=["GET"])
def index():
    """Root endpoint with API documentation."""
    return jsonify({
        "message": "NAMASTE-ICD11 FHIR Terminology Service",
        "version": "1.0.0",
        "compliance": "FHIR R4, India EHR Standards 2016",
        "security": "OAuth 2.0 (ABHA Mock Implementation)",
        "endpoints": {
            "search_conditions": {"method": "GET", "path": "/search/conditions?q={query}", "secured": True},
            "mapping_profile": {"method": "GET", "path": "/mapping-profile/{code}", "secured": True},
            "search_icd11": {"method": "GET", "path": "/search/icd11?q={query}", "secured": True},
            "create_encounter": {"method": "POST", "path": "/encounters", "secured": True},
            "add_problem": {"method": "POST", "path": "/encounters/{id}/problems", "secured": True},
            "stats": {"method": "GET", "path": "/mapping-stats", "secured": True},
            "health": {"method": "GET", "path": "/health", "secured": False},
            "documentation": {"method": "GET", "path": "/mapping-cases", "secured": False}
        },
        "description": "FHIR-compliant terminology service for mapping between NAMASTE and ICD-11 (TM2 & Biomedicine) with ICD-11 coding rule validation."
    })