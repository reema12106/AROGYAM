import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

# Database config for Railway (from .env)
db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT")),  # default to 3306 if not set
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASS"),
    "database": os.getenv("DB_NAME")
}

# Global pool object
connection_pool = None

def init_db(app=None):
    """
    Initialize MySQL connection pool.
    Called once from create_app().
    """
    global connection_pool
    if not connection_pool:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="arogyam_pool",
            pool_size=5,
            pool_reset_session=True,
            **db_config
        )
        if app:
            app.logger.info("✅ MySQL connection pool created.")

def get_connection():
    """
    Get a connection from the pool.
    """
    global connection_pool
    if not connection_pool:
        raise RuntimeError("❌ Database not initialized. Call init_db(app) first.")
    return connection_pool.get_connection()

def test_query():
    """
    Run a simple query to check DB connectivity.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT NOW() as db_time;")
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result
