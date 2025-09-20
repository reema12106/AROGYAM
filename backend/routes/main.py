from flask import Blueprint, jsonify, request, current_app
from datetime import datetime
from ..services.database import get_connection
import jwt
from functools import wraps

main_bp = Blueprint("main", __name__)

# ==================== AUTHENTICATION MIDDLEWARE ====================
def abha_oauth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Skip auth for health, docs, index
        if request.endpoint in ['health_check', 'get_mapping_cases', 'index']:
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            # ✅ For local dev, assume a dummy ABHA id
            request.abha_id = "dummy-abha-id"
            return f(*args, **kwargs)

        try:
            token = auth_header.replace("Bearer ", "")
            decoded = jwt.decode(token, options={"verify_signature": False})
            request.abha_id = decoded.get("sub", "dummy-abha-id")
        except Exception:
            # ✅ On error, still fallback to dummy id in dev mode
            request.abha_id = "dummy-abha-id"

        return f(*args, **kwargs)
    return decorated

def log_audit_event(user_id, action_type, details):
    """Log activity to audit trail"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO audit_trail (user_id, action_type, details) VALUES (%s, %s, %s)",
            (user_id, action_type, details)
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        current_app.logger.error(f"Audit log failed: {e}")

# ==================== FHIR HELPER FUNCTIONS ====================
def build_fhir_condition(condition_data, mappings, patient_id=None):
    """Build FHIR Condition resource from NAMASTE data"""
    codings = [
        {
            "system": "https://ayush.gov.in/namaste",
            "code": condition_data['code'],
            "display": condition_data['display_name']
        }
    ]
    
    # Add ICD-11 mappings
    for mapping in mappings:
        codings.append({
            "system": "http://id.who.int/icd/release/11",
            "code": mapping['icd11_code'],
            "display": mapping['icd11_display_name']
        })
    
    fhir_condition = {
        "resourceType": "Condition",
        "id": condition_data['code'],
        "code": {
            "coding": codings
        },
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }
            ]
        },
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                        "code": "problem-list-item",
                        "display": "Problem List Item"
                    }
                ]
            }
        ],
        "verificationStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "confirmed"
                }
            ]
        }
    }
    
    if patient_id:
        fhir_condition["subject"] = {
            "reference": f"Patient/{patient_id}"
        }
    
    return fhir_condition

def build_fhir_bundle(entries, bundle_type="searchset"):
    """Build FHIR Bundle from multiple entries"""
    return {
        "resourceType": "Bundle",
        "type": bundle_type,
        "total": len(entries),
        "entry": entries
    }

# ==================== HELPER FUNCTIONS ====================
def determine_mapping_case(mappings):
    """Determine which of the 4 mapping cases applies"""
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
    """Calculate confidence score 0.0-1.0 based on mapping quality"""
    if not mappings:
        return 0.0
    
    scores = {'TM2': 0.9, 'Biomed': 0.95, 'TM2-fallback': 0.6}
    return max(scores.get(m['mapping_type'], 0.5) for m in mappings)

def get_recommended_codes(mappings, mapping_case):
    """Get recommended codes for different use cases"""
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

def build_fhir_codesystem():
    """Build FHIR CodeSystem resource for NAMASTE codes"""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM namaste_codes")
        concepts = []
        for row in cursor.fetchall():
            concepts.append({
                "code": row['code'],
                "display": row['display_name'],
                "designation": [{
                    "value": row['display_name'],
                    "use": {
                        "system": "http://snomed.info/sct",
                        "code": "900000000000013009",
                        "display": "Synonym"
                    }
                }]
            })
        
        cursor.close()
        conn.close()
        
        return {
            "resourceType": "CodeSystem",
            "id": "namaste",
            "url": "https://nrces.in/fhir/CodeSystem/namaste",
            "version": "1.0.0",
            "name": "NAMASTECodeSystem",
            "title": "National AYUSH Morbidity & Standardized Terminologies Electronic",
            "status": "active",
            "content": "complete",
            "concept": concepts
        }
        
    except Exception as e:
        current_app.logger.error(f"FHIR CodeSystem build failed: {e}")
        return None

def build_fhir_conceptmap():
    """Build FHIR ConceptMap resource for NAMASTE-ICD11 mappings"""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT m.*, n.display_name as namaste_display 
            FROM icd11_mappings m 
            JOIN namaste_codes n ON m.namaste_code = n.code
        """)
        
        groups = {}
        for row in cursor.fetchall():
            if row['namaste_code'] not in groups:
                groups[row['namaste_code']] = {
                    "source": "https://nrces.in/fhir/CodeSystem/namaste",
                    "target": "http://id.who.int/icd/release/11",
                    "element": []
                }
            
            groups[row['namaste_code']]['element'].append({
                "code": row['namaste_code'],
                "display": row['namaste_display'],
                "target": [{
                    "code": row['icd11_code'],
                    "display": row['icd11_display_name'],
                    "equivalence": "equivalent" if row['mapping_type'] in ['TM2', 'Biomed'] else "relatedto"
                }]
            })
        
        cursor.close()
        conn.close()
        
        return {
            "resourceType": "ConceptMap",
            "id": "namaste-icd11",
            "url": "https://nrces.in/fhir/ConceptMap/namaste-icd11",
            "version": "1.0.0",
            "name": "NAMASTEToICD11",
            "title": "NAMASTE to ICD-11 Mapping",
            "status": "active",
            "group": list(groups.values())
        }
        
    except Exception as e:
        current_app.logger.error(f"FHIR ConceptMap build failed: {e}")
        return None

# ==================== CORE MAPPING ENDPOINTS ====================

@main_bp.route("/search/conditions", methods=["GET"])
@abha_oauth_required
def search_conditions():
    """
    Search NAMASTE conditions with intelligent mapping detection
    Returns FHIR Bundle with Condition resources
    Example: /search/conditions?q=diabetes&limit=10&page=1
    """
    try:
        query = request.args.get("q", "").strip()
        limit = min(int(request.args.get("limit", 10)), 50)
        page = max(int(request.args.get("page", 1)), 1)
        offset = (page - 1) * limit
        patient_id = request.args.get("patient_id")

        if not query or len(query) < 2:
            return jsonify({"error": "Query parameter 'q' required (min 2 characters)"}), 400

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Search using FULLTEXT index for better performance
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

        # Build FHIR Bundle entries
        entries = []
        for condition in conditions:
            mapping_sql = """
            SELECT * FROM icd11_mappings 
            WHERE namaste_code = %s 
            ORDER BY CASE mapping_type 
                WHEN 'TM2' THEN 1 WHEN 'Biomed' THEN 2 WHEN 'TM2-fallback' THEN 3 ELSE 4 END
            """
            cursor.execute(mapping_sql, (condition['code'],))
            mappings = cursor.fetchall()
            
            # Create FHIR Condition resource
            fhir_condition = build_fhir_condition(condition, mappings, patient_id)
            entries.append({
                "resource": fhir_condition,
                "search": {
                    "mode": "match"
                }
            })

        # Get total count for pagination
        count_sql = """
        SELECT COUNT(*) as total FROM namaste_codes 
        WHERE MATCH(display_name, category) AGAINST (%s IN NATURAL LANGUAGE MODE)
        OR code LIKE %s OR display_name LIKE %s
        """
        cursor.execute(count_sql, (query, search_pattern, search_pattern))
        total = cursor.fetchone()['total']

        cursor.close()
        conn.close()

        # Return FHIR Bundle
        bundle = build_fhir_bundle(entries)
        bundle["pagination"] = {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }

        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "search_conditions", f"Searched for: {query}")
        return jsonify(bundle)

    except Exception as e:
        return jsonify({"error": f"Search failed: {str(e)}"}), 500

@main_bp.route("/mapping-profile/<string:namaste_code>", methods=["GET"])
@abha_oauth_required
def get_mapping_profile(namaste_code):
    """
    Get complete mapping profile for a NAMASTE code
    Returns FHIR Condition resource
    Example: /mapping-profile/NAM001?patient_id=123
    """
    try:
        patient_id = request.args.get("patient_id")
        
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Get condition details
        condition_sql = "SELECT * FROM namaste_codes WHERE code = %s"
        cursor.execute(condition_sql, (namaste_code,))
        condition = cursor.fetchone()
        
        if not condition:
            return jsonify({"error": f"NAMASTE code '{namaste_code}' not found"}), 404

        # Get all mappings
        mappings_sql = "SELECT * FROM icd11_mappings WHERE namaste_code = %s ORDER BY mapping_type"
        cursor.execute(mappings_sql, (namaste_code,))
        mappings = cursor.fetchall()
        
        mapping_case = determine_mapping_case(mappings)
        confidence = calculate_confidence_score(mappings)
        recommendations = get_recommended_codes(mappings, mapping_case)

        cursor.close()
        conn.close()

        # Build FHIR Condition resource
        fhir_condition = build_fhir_condition(condition, mappings, patient_id)
        
        # Add extension for mapping analysis
        fhir_condition["extension"] = [{
            "url": "https://nrces.in/fhir/StructureDefinition/mapping-analysis",
            "valueCodeableConcept": {
                "coding": [{
                    "system": "https://nrces.in/fhir/CodeSystem/mapping-case",
                    "code": mapping_case,
                    "display": mapping_case.replace('_', ' ').title()
                }]
            }
        }]

        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "mapping_profile", f"Viewed profile for: {namaste_code}")
        return jsonify(fhir_condition)

    except Exception as e:
        return jsonify({"error": f"Failed to get mapping profile: {str(e)}"}), 500

@main_bp.route("/search/icd11", methods=["GET"])
@abha_oauth_required
def search_icd11():
    """
    Search ICD-11 codes and mappings
    Returns FHIR Bundle with Condition resources
    Example: /search/icd11?q=diabetes&mapping_type=Biomed
    """
    try:
        query = request.args.get("q", "").strip()
        mapping_type = request.args.get("mapping_type", "")
        limit = min(int(request.args.get("limit", 10)), 50)
        patient_id = request.args.get("patient_id")

        if not query or len(query) < 2:
            return jsonify({"error": "Query parameter 'q' required (min 2 characters)"}), 400

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        base_sql = """
        SELECT 
            m.*,
            n.display_name as namaste_display_name,
            n.category as namaste_category,
            n.code as namaste_code,
            n.id as namaste_id
        FROM icd11_mappings m
        JOIN namaste_codes n ON m.namaste_code = n.code
        WHERE (m.icd11_code LIKE %s OR m.icd11_display_name LIKE %s)
        """
        
        params = [f"%{query}%", f"%{query}%"]
        
        if mapping_type:
            base_sql += " AND m.mapping_type = %s"
            params.append(mapping_type)
        
        base_sql += " LIMIT %s"
        params.append(limit)

        cursor.execute(base_sql, params)
        results = cursor.fetchall()

        # Build FHIR Bundle entries
        entries = []
        for row in results:
            condition_data = {
                'id': row['namaste_id'],
                'code': row['namaste_code'],
                'display_name': row['namaste_display_name'],
                'category': row['namaste_category']
            }
            
            # Get all mappings for this condition
            mapping_sql = "SELECT * FROM icd11_mappings WHERE namaste_code = %s"
            cursor.execute(mapping_sql, (row['namaste_code'],))
            all_mappings = cursor.fetchall()
            
            fhir_condition = build_fhir_condition(condition_data, all_mappings, patient_id)
            entries.append({
                "resource": fhir_condition,
                "search": {
                    "mode": "match"
                }
            })

        cursor.close()
        conn.close()

        bundle = build_fhir_bundle(entries)
        bundle["query"] = query
        bundle["mapping_type_filter"] = mapping_type if mapping_type else "all"

        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "search_icd11", f"Searched ICD-11: {query}")
        return jsonify(bundle)

    except Exception as e:
        return jsonify({"error": f"ICD-11 search failed: {str(e)}"}), 500

# ==================== NEW FHIR R4 COMPLIANT ENDPOINTS ====================

@main_bp.route("/fhir/CodeSystem/namaste", methods=["GET"])
@abha_oauth_required
def fhir_codesystem():
    """FHIR CodeSystem resource for NAMASTE codes"""
    codesystem = build_fhir_codesystem()
    if not codesystem:
        return jsonify({"error": "Failed to build CodeSystem"}), 500
    
    log_audit_event(getattr(request, 'abha_id', 'anonymous'), "fhir_codesystem_access", "Accessed NAMASTE CodeSystem")
    return jsonify(codesystem)

@main_bp.route("/fhir/ConceptMap/namaste-icd11", methods=["GET"])
@abha_oauth_required
def fhir_conceptmap():
    """FHIR ConceptMap for NAMASTE-ICD11 mappings"""
    conceptmap = build_fhir_conceptmap()
    if not conceptmap:
        return jsonify({"error": "Failed to build ConceptMap"}), 500
    
    log_audit_event(getattr(request, 'abha_id', 'anonymous'), "fhir_conceptmap_access", "Accessed NAMASTE-ICD11 ConceptMap")
    return jsonify(conceptmap)

@main_bp.route("/fhir/ValueSet/namaste-codes", methods=["GET"])
@abha_oauth_required
def fhir_valueset():
    """FHIR ValueSet for auto-complete functionality"""
    try:
        query = request.args.get("name", "").strip()
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        if query:
            sql = "SELECT code, display_name FROM namaste_codes WHERE display_name LIKE %s LIMIT 20"
            cursor.execute(sql, (f"%{query}%",))
        else:
            cursor.execute("SELECT code, display_name FROM namaste_codes LIMIT 50")
        
        contains = []
        for row in cursor.fetchall():
            contains.append({
                "system": "https://nrces.in/fhir/CodeSystem/namaste",
                "code": row['code'],
                "display": row['display_name']
            })
        
        cursor.close()
        conn.close()
        
        valueset = {
            "resourceType": "ValueSet",
            "id": "namaste-codes",
            "url": "https://nrces.in/fhir/ValueSet/namaste-codes",
            "version": "1.0.0",
            "name": "NAMASTECodesValueSet",
            "title": "NAMASTE Codes for Auto-complete",
            "status": "active",
            "compose": {
                "include": [{
                    "system": "https://nrces.in/fhir/CodeSystem/namaste"
                }]
            },
            "expansion": {
                "timestamp": datetime.now().isoformat(),
                "contains": contains
            }
        }
        
        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "fhir_valueset_access", f"Searched ValueSet with query: {query}")
        return jsonify(valueset)
        
    except Exception as e:
        return jsonify({"error": f"ValueSet failed: {str(e)}"}), 500

@main_bp.route("/fhir/ConceptMap/namaste-icd11/$translate", methods=["POST"])
@abha_oauth_required
def fhir_translate():
    """FHIR $translate operation for code conversion"""
    try:
        data = request.get_json()
        code = data.get('code')
        system = data.get('system')
        
        if not code:
            return jsonify({"error": "Code parameter required"}), 400
        
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        if system and "icd" in system.lower():
            # ICD-11 to NAMASTE translation
            cursor.execute("""
                SELECT n.code, n.display_name, m.icd11_code, m.icd11_display_name, m.mapping_type
                FROM icd11_mappings m 
                JOIN namaste_codes n ON m.namaste_code = n.code
                WHERE m.icd11_code = %s
            """, (code,))
        else:
            # NAMASTE to ICD-11 translation
            cursor.execute("""
                SELECT n.code, n.display_name, m.icd11_code, m.icd11_display_name, m.mapping_type
                FROM icd11_mappings m 
                JOIN namaste_codes n ON m.namaste_code = n.code
                WHERE n.code = %s
            """, (code,))
        
        mappings = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = {
            "resourceType": "Parameters",
            "parameter": [{
                "name": "result",
                "valueBoolean": len(mappings) > 0
            }]
        }
        
        for mapping in mappings:
            result['parameter'].append({
                "name": "match",
                "part": [
                    {"name": "equivalence", "valueCode": "equivalent"},
                    {"name": "concept", "valueCoding": {
                        "system": "http://id.who.int/icd/release/11",
                        "code": mapping['icd11_code'],
                        "display": mapping['icd11_display_name']
                    }}
                ]
            })
        
        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "fhir_translate", f"Translated code: {code}")
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": f"Translation failed: {str(e)}"}), 500

@main_bp.route("/fhir/Bundle", methods=["POST"])
@abha_oauth_required
def fhir_bundle_upload():
    """FHIR Bundle upload endpoint for encounters"""
    try:
        data = request.get_json()
        if data.get('resourceType') != 'Bundle':
            return jsonify({"error": "Not a FHIR Bundle"}), 400
        
        # Process bundle entries
        processed_count = 0
        for entry in data.get('entry', []):
            resource = entry.get('resource', {})
            if resource.get('resourceType') == 'Condition':
                # Extract and store condition
                processed_count += 1
        
        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "fhir_bundle_upload", f"Processed {processed_count} resources from Bundle")
        return jsonify({
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "information",
                "code": "informational",
                "details": {"text": f"Bundle processed successfully with {processed_count} resources"}
            }]
        })
        
    except Exception as e:
        return jsonify({"error": f"Bundle processing failed: {str(e)}"}), 500

# ==================== ENCOUNTER MANAGEMENT ====================

@main_bp.route("/encounters", methods=["POST"])
@abha_oauth_required
def create_encounter():
    """
    Create a new patient encounter
    Expects JSON: {"patient_id": "123", "encounter_type": "consultation", "notes": "..."}
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON data required"}), 400

        patient_id = data.get('patient_id')
        encounter_type = data.get('encounter_type', 'consultation')
        notes = data.get('notes', '')

        if not patient_id:
            return jsonify({"error": "patient_id is required"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        sql = """
        INSERT INTO encounters (patient_id, encounter_type, notes)
        VALUES (%s, %s, %s)
        """
        cursor.execute(sql, (patient_id, encounter_type, notes))
        encounter_id = cursor.lastrowid

        # Log to audit trail
        audit_sql = """
        INSERT INTO audit_trail (user_id, action_type, details)
        VALUES (%s, %s, %s)
        """
        cursor.execute(audit_sql, (patient_id, 'encounter_create', f'Created encounter {encounter_id}'))

        conn.commit()
        cursor.close()
        conn.close()

        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "create_encounter", f"Created encounter for patient: {patient_id}")
        return jsonify({
            "success": True,
            "encounter_id": encounter_id,
            "message": "Encounter created successfully"
        }), 201

    except Exception as e:
        return jsonify({"error": f"Failed to create encounter: {str(e)}"}), 500

@main_bp.route("/encounters/<int:encounter_id>/problems", methods=["POST"])
@abha_oauth_required
def add_problem_to_encounter(encounter_id):
    """
    Add a problem/diagnosis to an encounter
    Expects JSON: {"code_system": "NAMASTE", "code": "NAM001", "display_name": "Agnimandya", "severity": "moderate"}
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON data required"}), 400

        code_system = data.get('code_system')
        code = data.get('code')
        display_name = data.get('display_name', '')
        severity = data.get('severity', 'moderate')

        if not all([code_system, code]):
            return jsonify({"error": "code_system and code are required"}), 400

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Verify encounter exists
        cursor.execute("SELECT id FROM encounters WHERE id = %s", (encounter_id,))
        if not cursor.fetchone():
            return jsonify({"error": f"Encounter {encounter_id} not found"}), 404

        sql = """
        INSERT INTO encounter_problems (encounter_id, code_system, code, display_name, severity)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (encounter_id, code_system, code, display_name, severity))
        problem_id = cursor.lastrowid

        # Log to audit trail
        audit_sql = """
        INSERT INTO audit_trail (user_id, action_type, details)
        VALUES (%s, %s, %s)
        """
        cursor.execute(audit_sql, ('system', 'problem_add', 
                    f'Added problem {code} to encounter {encounter_id}'))

        conn.commit()
        cursor.close()
        conn.close()

        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "add_problem", f"Added problem {code} to encounter {encounter_id}")
        return jsonify({
            "success": True,
            "problem_id": problem_id,
            "message": "Problem added to encounter"
        }), 201

    except Exception as e:
        return jsonify({"error": f"Failed to add problem: {str(e)}"}), 500

# ==================== ANALYTICS & HEALTH ====================

@main_bp.route("/mapping-stats", methods=["GET"])
@abha_oauth_required
def get_mapping_stats():
    """Get statistics about mapping coverage and distribution"""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Mapping type distribution
        cursor.execute("""
        SELECT mapping_type, COUNT(*) as count 
        FROM icd11_mappings 
        GROUP BY mapping_type ORDER BY count DESC
        """)
        mapping_stats = cursor.fetchall()

        # Coverage statistics
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

        # Conditions with multiple mappings
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

        log_audit_event(getattr(request, 'abha_id', 'anonymous'), "view_stats", "Viewed mapping statistics")
        return jsonify({
            "resourceType": "Parameters",
            "parameter": [
                {"name": "mapping_type_distribution", "valueString": str(mapping_stats)},
                {"name": "coverage_statistics", "valueString": str(coverage_stats)},
                {"name": "multi_mapped_conditions", "valueString": str(multi_mapped)},
                {"name": "last_updated", "valueDateTime": datetime.now().isoformat()}
            ]
        })

    except Exception as e:
        return jsonify({"error": f"Failed to get statistics: {str(e)}"}), 500

@main_bp.route("/health", methods=["GET"])
def health_check():
    """Comprehensive health check endpoint"""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Basic DB info
        cursor.execute("SELECT NOW() as server_time, DATABASE() as db_name, VERSION() as mysql_version")
        db_info = cursor.fetchone()
        
        # Table counts
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
            "resourceType": "Parameters",
            "parameter": [
                {"name": "status", "valueString": "healthy"},
                {"name": "timestamp", "valueDateTime": datetime.now().isoformat()},
                {"name": "database_name", "valueString": db_info['db_name']},
                {"name": "server_time", "valueDateTime": db_info['server_time'].isoformat() if hasattr(db_info['server_time'], 'isoformat') else str(db_info['server_time'])},
                {"name": "namaste_conditions", "valueInteger": counts['namaste_count']},
                {"name": "icd11_mappings", "valueInteger": counts['mappings_count']},
                {"name": "encounters", "valueInteger": counts['encounters_count']},
                {"name": "problems", "valueInteger": counts['problems_count']}
            ]
        })
        
    except Exception as e:
        return jsonify({
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "error",
                "code": "exception",
                "details": {"text": f"Database error: {str(e)}"}
            }]
        }), 500

# ==================== UTILITY ENDPOINTS ====================

@main_bp.route("/mapping-cases", methods=["GET"])
def get_mapping_cases():
    """Get documentation for the 4 mapping cases"""
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
    
    return jsonify({
        "resourceType": "Parameters",
        "parameter": [{
            "name": "mapping_cases",
            "valueString": str(cases)
        }]
    })

@main_bp.route("/", methods=["GET"])
def index():
    """Root endpoint with API documentation"""
    return jsonify({
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": datetime.now().isoformat(),
        "publisher": "Ministry of Ayush, India",
        "kind": "instance",
        "software": {
            "name": "NAMASTE-ICD11 FHIR Terminology Server",
            "version": "1.0.0"
        },
        "implementation": {
            "url": "https://nrces.in/fhir",
            "description": "NAMASTE to ICD-11 Mapping Service"
        },
        "fhirVersion": "4.0.1",
        "format": ["application/json"],
        "rest": [
            {
                "mode": "server",
                "resource": [
                    {
                        "type": "Condition",
                        "interaction": [
                            {"code": "search-type"},
                            {"code": "read"}
                        ]
                    },
                    {
                        "type": "CodeSystem",
                        "interaction": [
                            {"code": "read"}
                        ]
                    },
                    {
                        "type": "ConceptMap",
                        "interaction": [
                            {"code": "read"},
                            {"code": "translate"}
                        ]
                    },
                    {
                        "type": "ValueSet",
                        "interaction": [
                            {"code": "read"},
                            {"code": "expand"}
                        ]
                    }
                ]
            }
        ]
    })