class Config:
    SECRET_KEY = "your-super-secure-secret-key-here"
    DEBUG = True
    
    # Database Configuration (using your existing MySQL setup)
    DB_CONFIG = {
        "host": "tramway.proxy.rlwy.net",
        "port": 17682,
        "user": "root",
        "password": "ORIEdIXeemgmECRvQVhlDOFqiTcCneef",
        "database": "sih_db",
        "ssl_disabled": True
    }
    
    # Twilio Configuration
    TWILIO_ACCOUNT_SID = "AC21fae1318a49f90433da34163d3805c9"
    TWILIO_AUTH_TOKEN = "9369f533770f8e1fabc1f2454feda253"
    TWILIO_PHONE_NUMBER = "+17176743068"
    
    # OTP Configuration
    OTP_EXPIRY_MINUTES = 10
    OTP_LENGTH = 6
    
    # JWT Configuration
    JWT_SECRET_KEY = "jwt-super-secret-key-change-in-production"