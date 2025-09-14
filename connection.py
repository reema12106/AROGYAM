import mysql.connector

_config = {
    "host": "tramway.proxy.rlwy.net",
    "port": 17682,
    "user": "root",
    "password": "ORIEdIXeemgmECRvQVhlDOFqiTcCneef",
    "database": "sih_db"
}

conn = mysql.connector.connect(**_config)
cursor = conn.cursor()

cursor.execute("SHOW TABLES;")
for table in cursor.fetchall():
    print(table)

conn.close()
