import os
import pandas as pd

# Path to data folder
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def load_namaste():
    path = os.path.join(DATA_DIR, "namaste.csv")
    return pd.read_csv(path)

def load_icd_codes():
    path = os.path.join(DATA_DIR, "icd_codes.csv")
    return pd.read_csv(path)
