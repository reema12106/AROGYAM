from flask import Blueprint, jsonify, request
from datetime import datetime
from ..services.database import get_connection

main_bp = Blueprint("main", __name__)

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

# ==================== CORE MAPPING ENDPOINTS ====================

@main_bp.route("/search/conditions", methods=["GET"])
def search_conditions():
    """
    Search NAMASTE conditions with intelligent mapping detection
    Example: /search/conditions?q=diabetes&limit=10&page=1
    """
    try:
        query = request.args.get("q", "").strip()
        limit = min(int(request.args.get("limit", 10)), 50)
        page = max(int(request.args.get("page", 1)), 1)
        offset = (page - 1) * limit

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

        # Get mappings for each condition
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
def get_mapping_profile(namaste_code):
    """
    Get complete mapping profile for a NAMASTE code
    Example: /mapping-profile/NAM001
    """
    try:
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

@main_bp.route("/search/icd11", methods=["GET"])
def search_icd11():
    """
    Search ICD-11 codes and mappings
    Example: /search/icd11?q=diabetes&mapping_type=Biomed
    """
    try:
        query = request.args.get("q", "").strip()
        mapping_type = request.args.get("mapping_type", "")
        limit = min(int(request.args.get("limit", 10)), 50)

        if not query or len(query) < 2:
            return jsonify({"error": "Query parameter 'q' required (min 2 characters)"}), 400

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        base_sql = """
        SELECT 
            m.*,
            n.display_name as namaste_display_name,
            n.category as namaste_category,
            n.code as namaste_code
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

        cursor.close()
        conn.close()

        return jsonify({
            "results": results,
            "query": query,
            "mapping_type_filter": mapping_type if mapping_type else "all",
            "total_results": len(results)
        })

    except Exception as e:
        return jsonify({"error": f"ICD-11 search failed: {str(e)}"}), 500

# ==================== ENCOUNTER MANAGEMENT ====================

@main_bp.route("/encounters", methods=["POST"])
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

        return jsonify({
            "success": True,
            "encounter_id": encounter_id,
            "message": "Encounter created successfully"
        }), 201

    except Exception as e:
        return jsonify({"error": f"Failed to create encounter: {str(e)}"}), 500

@main_bp.route("/encounters/<int:encounter_id>/problems", methods=["POST"])
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

        return jsonify({
            "success": True,
            "problem_id": problem_id,
            "message": "Problem added to encounter"
        }), 201

    except Exception as e:
        return jsonify({"error": f"Failed to add problem: {str(e)}"}), 500

# ==================== ANALYTICS & HEALTH ====================

@main_bp.route("/mapping-stats", methods=["GET"])
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
    
    return jsonify({"mapping_cases": cases})

@main_bp.route("/", methods=["GET"])
def index():
    """Root endpoint with API documentation"""
    return jsonify({
        "message": "NAMASTE-ICD11 Mapping API",
        "version": "1.0.0",
        "endpoints": {
            "search_conditions": {"method": "GET", "path": "/search/conditions?q={query}"},
            "mapping_profile": {"method": "GET", "path": "/mapping-profile/{code}"},
            "search_icd11": {"method": "GET", "path": "/search/icd11?q={query}"},
            "create_encounter": {"method": "POST", "path": "/encounters"},
            "add_problem": {"method": "POST", "path": "/encounters/{id}/problems"},
            "stats": {"method": "GET", "path": "/mapping-stats"},
            "health": {"method": "GET", "path": "/health"},
            "documentation": {"method": "GET", "path": "/mapping-cases"}
        },
        "description": "API for mapping between NAMASTE traditional medicine codes and ICD-11 standards"
    })