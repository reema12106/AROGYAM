from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from ..services.database import get_connection
from ..services.auth_service import auth_service
import jwt

auth_bp = Blueprint("auth", _name_)

@auth_bp.route("/auth/register", methods=["POST"])
def register_user():
    """Register a new user with ABHA number"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON data required"}), 400
        
        abha_number = data.get('abha_number')
        phone_number = data.get('phone_number')
        name = data.get('name')
        
        if not all([abha_number, phone_number]):
            return jsonify({"error": "ABHA number and phone number are required"}), 400
        
        # Validate phone number format
        if not auth_service.validate_phone_number(phone_number):
            return jsonify({"error": "Invalid phone number format. Use +91XXXXXXXXXX"}), 400
        
        # Validate ABHA number format
        if not auth_service.validate_abha_number(abha_number):
            return jsonify({"error": "Invalid ABHA number format. Use XX-XXXX-XXXX-XXXX"}), 400
        
        # Register user
        success, message = auth_service.register_user(abha_number, phone_number, name)
        
        if not success:
            return jsonify({"error": message}), 400
        
        return jsonify({
            "success": True,
            "message": message,
            "data": {
                "abha_number": abha_number,
                "phone_number": phone_number,
                "name": name
            }
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@auth_bp.route("/auth/send-otp", methods=["POST"])
def send_otp():
    """Send OTP to user's phone number"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON data required"}), 400
        
        abha_number = data.get('abha_number')
        phone_number = data.get('phone_number')
        
        if not all([abha_number, phone_number]):
            return jsonify({"error": "ABHA number and phone number are required"}), 400
        
        # Verify user exists
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM users WHERE abha_number = %s AND phone_number = %s",
            (abha_number, phone_number)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Generate OTP
        otp_code = auth_service.generate_otp()
        
        # Store OTP in database
        success, message = auth_service.store_otp(abha_number, phone_number, otp_code)
        
        if not success:
            return jsonify({"error": message}), 500
        
        # Send OTP via Twilio
        success, message = auth_service.send_otp_via_twilio(phone_number, otp_code)
        
        if not success:
            return jsonify({"error": message}), 500
        
        return jsonify({
            "success": True,
            "message": "OTP sent successfully",
            "data": {
                "abha_number": abha_number,
                "phone_number": phone_number,
                "otp_expiry_minutes": current_app.config['OTP_EXPIRY_MINUTES']
            }
        })
        
    except Exception as e:
        return jsonify({"error": f"OTP sending failed: {str(e)}"}), 500

@auth_bp.route("/auth/verify-otp", methods=["POST"])
def verify_otp():
    """Verify OTP and generate JWT token"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON data required"}), 400
        
        abha_number = data.get('abha_number')
        phone_number = data.get('phone_number')
        otp_code = data.get('otp_code')
        
        if not all([abha_number, phone_number, otp_code]):
            return jsonify({"error": "ABHA number, phone number and OTP are required"}), 400
        
        # Verify OTP
        success, message = auth_service.verify_otp(abha_number, phone_number, otp_code)
        
        if not success:
            return jsonify({"error": message}), 400
        
        # Generate JWT token
        token = auth_service.generate_jwt_token(abha_number, phone_number)
        
        return jsonify({
            "success": True,
            "message": "OTP verified successfully",
            "data": {
                "access_token": token,
                "token_type": "bearer",
                "expires_in": 86400,  # 24 hours
                "abha_number": abha_number,
                "phone_number": phone_number
            }
        })
        
    except Exception as e:
        return jsonify({"error": f"OTP verification failed: {str(e)}"}), 500

@auth_bp.route("/auth/validate-token", methods=["POST"])
def validate_token():
    """Validate JWT token"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Bearer token required"}), 401
        
        token = auth_header.replace('Bearer ', '')
        success, result = auth_service.validate_jwt_token(token)
        
        if not success:
            return jsonify({"error": result}), 401
        
        return jsonify({
            "success": True,
            "message": "Token is valid",
            "data": result
        })
        
    except Exception as e:
        return jsonify({"error": f"Token validation failed: {str(e)}"}), 500

@auth_bp.route("/auth/user-profile", methods=["GET"])
def get_user_profile():
    """Get user profile using JWT token"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Bearer token required"}), 401
        
        token = auth_header.replace('Bearer ', '')
        success, result = auth_service.validate_jwt_token(token)
        
        if not success:
            return jsonify({"error": result}), 401
        
        # Get user details from database
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT abha_number, phone_number, name, is_verified, created_at FROM users WHERE abha_number = %s",
            (result['sub'],)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "success": True,
            "data": user
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to get user profile: {str(e)}"}), 500