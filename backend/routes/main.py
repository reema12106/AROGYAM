from flask import Blueprint, jsonify, request
from ..services.database import get_connection

main_bp = Blueprint("main", __name__)

@main_bp.route("/search")
def search():
    """
    Search endpoint with query parameter.
    Example: /search?q=Reema
    """
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({"error": "Missing search query ?q="}), 400

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # 🔹 LIKE search (case-insensitive)
        sql = "SELECT * FROM test_table WHERE name LIKE %s"
        cursor.execute(sql, (f"%{query}%",))
        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({"results": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@main_bp.route("/translate")
def translate():
    return jsonify({"message": "translate endpoint working"})


@main_bp.route("/encounter")
def encounter():
    return jsonify({"message": "encounter endpoint working"})
