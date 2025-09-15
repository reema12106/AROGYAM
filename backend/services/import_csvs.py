# backend/services/import_csvs.py
import os
import pandas as pd
import mysql.connector

# Direct DB config (replace with your Railway values)
DB_CONFIG = {
    "host": "tramway.proxy.rlwy.net",
    "port": 17682,
    "user": "root",
    "password": "ORIEdIXeemgmECRvQVhlDOFqiTcCneef",
    "database": "sih_db",
    "ssl_disabled": True
}

def get_conn():
    return mysql.connector.connect(**DB_CONFIG)

def import_namaste(csv_path):
    df = pd.read_csv(csv_path, dtype=str).fillna("")
    rows = []
    for _, r in df.iterrows():
        rows.append((r.get("code"),
                     "NAMASTE",   # default system
                     r.get("display_name"),
                     r.get("category", None)))

    sql = """
    INSERT INTO namaste_codes (`code`, `system`, `display_name`, `category`)
VALUES (%s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
  `system` = VALUES(`system`),
  `display_name` = VALUES(`display_name`),
  `category` = VALUES(`category`)
    """
    conn = get_conn()
    cur = conn.cursor()

    # 🔥 Reset table before inserting
    cur.execute("DELETE FROM namaste_codes")

    cur.executemany(sql, rows)
    conn.commit()
    cur.close()
    conn.close()
    print(f"Imported {len(rows)} namaste rows (table reset).")
    #..

def import_icd11_mappings(csv_path):
    df = pd.read_csv(csv_path, dtype=str).fillna("")
    rows = []
    for _, r in df.iterrows():
        rows.append((r.get("namaste_code"),
                     r.get("icd11_code"),
                     r.get("icd11_display_name"),
                     r.get("mapping_type")))

    sql = """
    INSERT INTO icd11_mappings (namaste_code, icd11_code, icd11_display_name, mapping_type)
    VALUES (%s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
      icd11_display_name = VALUES(icd11_display_name),
      mapping_type = VALUES(mapping_type)
    """
    conn = get_conn()
    cur = conn.cursor()

    # 🔥 Reset table before inserting
    cur.execute("DELETE FROM icd11_mappings")

    cur.executemany(sql, rows)
    conn.commit()
    cur.close()
    conn.close()
    print(f"Imported {len(rows)} icd11 mapping rows (table reset).")

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(__file__))  # backend/services -> backend
    data_dir = os.path.join(project_root, "data")

    import_namaste(os.path.join(data_dir, "namaste.csv"))
    import_icd11_mappings(os.path.join(data_dir, "icd_codes.csv"))
