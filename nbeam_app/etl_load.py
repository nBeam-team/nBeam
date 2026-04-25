# etl_load.py
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import os

DB_URL = "postgresql://postgres:mysecret@localhost:5432/renewable_tool"
PROJECT_DATA_DIR = "Project_Data"
STATUS_FILENAME = "projects_status_quo.csv"
PARTS_FILENAME = "project_options_parts.csv"

def load_all_status_files(data_dir):
    """Load all status CSV files into a single raw DataFrame."""
    all_dfs = []
    for root, dirs, files in os.walk(data_dir):
        if STATUS_FILENAME in files:
            path = os.path.join(root, STATUS_FILENAME)
            print(f"Loading {path}")
            df = pd.read_csv(path)
            all_dfs.append(df)
    if not all_dfs:
        return None
    return pd.concat(all_dfs, ignore_index=True)

def compute_medians(df_raw):
    """Compute medians for columns that may need imputation."""
    medians = {}
    cols = ['base_price_per_month', 'energy_price_increase', 'base_price_increase']
    for col in cols:
        if col in df_raw.columns:
            # Convert to numeric, coerce errors to NaN, then median
            numeric_series = pd.to_numeric(df_raw[col], errors='coerce')
            medians[col] = numeric_series.median()
            print(f"Median for {col}: {medians[col]}")
    return medians

def clean_status(df, medians):
    """Clean the combined status DataFrame using global medians."""
    df_clean = df.copy()
    
    # Unit conversions
    df_clean['energy_demand_kwh'] = pd.to_numeric(df_clean['energy_demand_wh'], errors='coerce') / 1000.0
    df_clean['energy_price_per_kwh'] = pd.to_numeric(df_clean['energy_price_per_wh'], errors='coerce') * 1000.0
    
    # Convert numeric fields (may be strings or missing)
    df_clean['energy_price_increase'] = pd.to_numeric(df_clean['energy_price_increase'], errors='coerce')
    df_clean['base_price_per_month'] = pd.to_numeric(df_clean['base_price_per_month'], errors='coerce')
    df_clean['base_price_increase'] = pd.to_numeric(df_clean['base_price_increase'], errors='coerce')
    
    # Impute missing using medians (fallback to defaults if median is NaN)
    df_clean['energy_price_increase'] = df_clean['energy_price_increase'].fillna(medians.get('energy_price_increase', 0.02))
    df_clean['base_price_per_month'] = df_clean['base_price_per_month'].fillna(medians.get('base_price_per_month', 0.0))
    df_clean['base_price_increase'] = df_clean['base_price_increase'].fillna(medians.get('base_price_increase', 0.01))
    
    # Boolean flags
    bool_cols = ['has_ev', 'has_solar', 'has_storage', 'has_wallbox']
    for col in bool_cols:
        if col in df_clean.columns:
            df_clean[col] = df_clean[col].astype(bool, errors='ignore').fillna(False)
    
    # Drop rows where critical data is still missing
    df_clean = df_clean.dropna(subset=['project_id', 'energy_demand_kwh', 'energy_price_per_kwh'])
    
    # Add derived column
    df_clean['annual_energy_cost_current'] = (df_clean['energy_demand_kwh'] * df_clean['energy_price_per_kwh'] +
                                               df_clean['base_price_per_month'] * 12)
    return df_clean

def main():
    engine = create_engine(DB_URL)
    
    # Step 1: Load all raw status data
    df_raw = load_all_status_files(PROJECT_DATA_DIR)
    if df_raw is None:
        print("No status CSV files found. Exiting.")
        return
    print(f"Total raw rows: {len(df_raw)}")
    
    # Step 2: Compute medians from the combined raw data
    medians = compute_medians(df_raw)
    
    # Step 3: Clean the combined raw data using those medians
    df_clean = clean_status(df_raw, medians)
    print(f"Cleaned rows remaining: {len(df_clean)}")
    
    # Step 4: Remove duplicate project_ids if any
    if df_clean['project_id'].duplicated().any():
        print("Warning: Duplicate project_ids found. Keeping first occurrence.")
        df_clean = df_clean.drop_duplicates(subset=['project_id'], keep='first')
    
    # Step 5: Write to PostgreSQL
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS projects CASCADE"))
        conn.commit()
    
    df_clean.to_sql('projects', engine, index=False, if_exists='replace')
    print(f"Loaded {len(df_clean)} projects into 'projects' table.")
    
    # (Optional: load parts table similarly)
    # ...

if __name__ == "__main__":
    main()