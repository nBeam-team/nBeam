import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text

DB_URL = "postgresql://postgres:mysecret@127.0.0.1:5432/renewable_tool"

def generate_synthetic_h0():
    """
    Generates a synthetic 8760-hour Standard Load Profile (BDEW H0 approximation).
    The profile is normalized so that the sum across all 8760 hours equals 1000 kWh.
    """
    # 2023 was a non-leap year (8760 hours)
    dates = pd.date_range(start='2023-01-01 00:00:00', periods=8760, freq='h')
    df = pd.DataFrame({'datetime': dates})
    
    df['month'] = df['datetime'].dt.month
    df['hour'] = df['datetime'].dt.hour
    
    # Seasonal multiplier: more consumption in winter
    # Winter=1.2, Spring/Fall=1.0, Summer=0.8
    season_mult = {
        1: 1.3, 2: 1.2, 3: 1.1, 4: 1.0, 5: 0.9, 6: 0.8,
        7: 0.8, 8: 0.8, 9: 0.9, 10: 1.0, 11: 1.2, 12: 1.3
    }
    df['season_factor'] = df['month'].map(season_mult)
    
    # Hourly multiplier: peaks in morning (07-09) and evening (18-21)
    base_hours = np.ones(8760)
    for i, hr in enumerate(df['hour']):
        if 0 <= hr <= 5:
            base_hours[i] = 0.4
        elif 6 <= hr <= 9:
            base_hours[i] = 1.2
        elif 10 <= hr <= 16:
            base_hours[i] = 0.9
        elif 17 <= hr <= 22:
            base_hours[i] = 1.5
        else: # 23
            base_hours[i] = 0.8
            
    df['hour_factor'] = base_hours
    
    # Add minor noise
    noise = np.random.normal(1.0, 0.05, 8760)
    
    # Combine
    df['weight'] = df['season_factor'] * df['hour_factor'] * noise
    
    # Normalize so sum = 1000 kWh
    total_weight = df['weight'].sum()
    df['normalized_kwh'] = (df['weight'] / total_weight) * 1000.0
    
    final_df = df[['datetime', 'normalized_kwh']].copy()
    return final_df

def main():
    engine = create_engine(DB_URL)
    df = generate_synthetic_h0()
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS bdew_h0_profile CASCADE"))
        conn.commit()
    
    # Write to postgres
    df.to_sql('bdew_h0_profile', engine, index=False, if_exists='replace')
    print(f"Successfully seeded {len(df)} hours of BDEW H0 data into 'bdew_h0_profile'.")

if __name__ == '__main__':
    main()
