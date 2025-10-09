import pandas as pd
import numpy as np

def generate_sample_dataset(n_samples=1000, output_path='data/sample_water_disease_data.csv'):
    """Generate sample dataset for testing"""
    
    print(f"🔬 Generating {n_samples} sample records...")
    
    np.random.seed(42)
    
    # Generate realistic water quality parameters
    data = []
    
    for i in range(n_samples):
        # pH: Normal range 6.5-8.5, contaminated 5.0-6.5 or 8.5-10.0
        if np.random.random() < 0.7:  # 70% normal
            pH = np.random.uniform(6.5, 8.5)
            contaminated = False
        else:  # 30% contaminated
            pH = np.random.choice([
                np.random.uniform(5.0, 6.5),
                np.random.uniform(8.5, 10.0)
            ])
            contaminated = True
        
        # Turbidity: Normal < 5 NTU, Medium 5-15, High > 15
        if contaminated:
            turbidity = np.random.uniform(10, 50)
        else:
            turbidity = np.random.uniform(0.5, 8)
        
        # Dissolved Oxygen: Normal > 6 mg/L, Low < 4 mg/L
        if contaminated:
            dissolved_oxygen = np.random.uniform(2, 5)
        else:
            dissolved_oxygen = np.random.uniform(5, 9)
        
        # Disease cases based on contamination
        if contaminated and turbidity > 20:
            # High risk
            diarrheal_cases = np.random.uniform(200, 500)
            cholera_cases = np.random.uniform(50, 150)
            typhoid_cases = np.random.uniform(30, 100)
        elif contaminated or turbidity > 10:
            # Medium risk
            diarrheal_cases = np.random.uniform(50, 200)
            cholera_cases = np.random.uniform(10, 50)
            typhoid_cases = np.random.uniform(5, 30)
        else:
            # Low risk
            diarrheal_cases = np.random.uniform(0, 50)
            cholera_cases = np.random.uniform(0, 10)
            typhoid_cases = np.random.uniform(0, 5)
        
        data.append({
            'pH Level': round(pH, 2),
            'Turbidity (NTU)': round(turbidity, 2),
            'Dissolved Oxygen (mg/L)': round(dissolved_oxygen, 2),
            'Diarrheal Cases per 100,000 people': round(diarrheal_cases, 1),
            'Cholera Cases per 100,000 people': round(cholera_cases, 1),
            'Typhoid Cases per 100,000 people': round(typhoid_cases, 1)
        })
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Save to CSV
    df.to_csv(output_path, index=False)
    
    print(f"✅ Generated dataset with {n_samples} samples")
    print(f"   Saved to: {output_path}")
    print(f"\n📊 Dataset Statistics:")
    print(df.describe())
    
    print(f"\n🎯 Disease Case Distribution:")
    print(f"   Low risk (<50): {len(df[df['Diarrheal Cases per 100,000 people'] < 50])}")
    print(f"   Medium risk (50-200): {len(df[(df['Diarrheal Cases per 100,000 people'] >= 50) & (df['Diarrheal Cases per 100,000 people'] < 200)])}")
    print(f"   High risk (>200): {len(df[df['Diarrheal Cases per 100,000 people'] >= 200])}")
    
    return output_path

if __name__ == "__main__":
    generate_sample_dataset()
