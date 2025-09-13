import mysql.connector

# 🔹 Replace with your Railway credentials (Public Network)
db_config = {
    "host": "tramway.proxy.rlwy.net",   # Host from Railway
    "port": 17682,                      # Port from Railway
    "user": "root",                     # Username from Railway
    "password": "ORIEdIXeemgmECRvQVhlDOFqiTcCneef",   # Copy from Railway
    "database": "railway"               # Default DB
}

try:
    # Connect to DB
    connection = mysql.connector.connect(**db_config)

    if connection.is_connected():
        print("✅ Connection successful!")

        cursor = connection.cursor()

        # Create a test table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_table (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                age INT
            )
        """)
        print("📦 Table ready!")

        # Insert test row
        cursor.execute("INSERT INTO test_table (name, age) VALUES (%s, %s)", ("Reema", 22))
        connection.commit()
        print("📝 Inserted test row!")

        # Fetch and print
        cursor.execute("SELECT * FROM test_table")
        rows = cursor.fetchall()
        print("📊 Current rows in table:")
        for row in rows:
            print(row)

        cursor.close()
        connection.close()
        print("🔌 Connection closed!")

except Exception as e:
    print("❌ Error:", e)
