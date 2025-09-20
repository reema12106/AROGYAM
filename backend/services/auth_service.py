import random
import string
from datetime import datetime, timedelta
from twilio.rest import Client
from ..services.database import get_connection
from ..config import Config
import jwt
import re

class AuthService:
    def __init__(self):
        # Initialize Twilio client with your credentials
        self.twilio_client = Client(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN)
    
    def generate_otp(self, length=6):
        """Generate a random numeric OTP"""
        return ''.join(random.choices(string.digits, k=length))
    
    def validate_phone_number(self, phone_number):
        """Validate Indian phone number format"""
        # Indian phone number regex: +91 followed by 10 digits
        pattern = r'^\+91[6-9]\d{9}$'
        return re.match(pattern, phone_number) is not None
    
    def validate_abha_number(self, abha_number):
        """Validate ABHA number format"""
        # Basic validation - ABHA numbers typically have a specific format
        pattern = r'^\d{2}-\d{4}-\d{4}-\d{4}$'
        return re.match(pattern, abha_number) is not None
    
    def send_otp_via_twilio(self, phone_number, otp_code):
        """Send OTP via Twilio SMS"""
        try:
            message = self.twilio_client.messages.create(
                body=f"Your Arogyaam verification code is: {otp_code}. This code will expire in 10 minutes.",
                from_=Config.TWILIO_PHONE_NUMBER,
                to=phone_number
            )
            return True, "OTP sent successfully"
        except Exception as e:
            return False, f"Failed to send OTP: {str(e)}"
    
    def store_otp(self, abha_number, phone_number, otp_code):
        """Store OTP in database with expiration"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Set expiration time (10 minutes from now)
            expires_at = datetime.now() + timedelta(minutes=Config.OTP_EXPIRY_MINUTES)
            
            # Insert OTP record
            cursor.execute(
                "INSERT INTO auth_otps (abha_number, phone_number, otp_code, expires_at) VALUES (%s, %s, %s, %s)",
                (abha_number, phone_number, otp_code, expires_at)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return True, "OTP stored successfully"
        except Exception as e:
            return False, f"Failed to store OTP: {str(e)}"
    
    def verify_otp(self, abha_number, phone_number, otp_code):
        """Verify OTP against database"""
        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Check for valid, unused OTP
            cursor.execute(
                """SELECT * FROM auth_otps 
                WHERE abha_number = %s AND phone_number = %s AND otp_code = %s 
                AND used = FALSE AND expires_at > NOW()""",
                (abha_number, phone_number, otp_code)
            )
            
            otp_record = cursor.fetchone()
            
            if not otp_record:
                cursor.close()
                conn.close()
                return False, "Invalid or expired OTP"
            
            # Mark OTP as used
            cursor.execute(
                "UPDATE auth_otps SET used = TRUE WHERE id = %s",
                (otp_record['id'],)
            )
            
            # Update user verification status
            cursor.execute(
                "UPDATE users SET is_verified = TRUE WHERE abha_number = %s",
                (abha_number,)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return True, "OTP verified successfully"
        except Exception as e:
            return False, f"OTP verification failed: {str(e)}"
    
    def generate_jwt_token(self, abha_number, phone_number):
        """Generate JWT token for authenticated user"""
        try:
            payload = {
                'sub': abha_number,
                'phone_number': phone_number,
                'exp': datetime.utcnow() + timedelta(hours=24)
            }
            token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')
            return token
        except Exception as e:
            raise Exception(f"Token generation failed: {str(e)}")
    
    def validate_jwt_token(self, token):
        """Validate JWT token"""
        try:
            payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
            return True, payload
        except jwt.ExpiredSignatureError:
            return False, "Token expired"
        except jwt.InvalidTokenError:
            return False, "Invalid token"
    
    def register_user(self, abha_number, phone_number, name):
        """Register a new user"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute(
                "SELECT id FROM users WHERE abha_number = %s OR phone_number = %s",
                (abha_number, phone_number)
            )
            
            if cursor.fetchone():
                cursor.close()
                conn.close()
                return False, "User already exists"
            
            # Insert new user
            cursor.execute(
                "INSERT INTO users (abha_number, phone_number, name) VALUES (%s, %s, %s)",
                (abha_number, phone_number, name)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return True, "User registered successfully"
        except Exception as e:
            return False, f"Registration failed: {str(e)}"

# Create global instance
auth_service = AuthService()