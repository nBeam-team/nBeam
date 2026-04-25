#!/usr/bin/env python
# coding: utf-8

# In[6]:


import pandas as pd
import os


# In[7]:


DATA_DIR = "/home/sankalp/Work_of_Life/tech_eu_hack/Project Data/23c108b7/"

df_status = pd.read_csv(os.path.join(DATA_DIR, "projects_status_quo.csv"))

df_parts = pd.read_csv(os.path.join(DATA_DIR,'project_options_parts.csv'))

print(df_status.info(), df_status.isnull().sum())
print(df_parts.groupby(['project_id', 'option_id']).size().value_counts())


# In[8]:


print("Status quo shape:", df_status.shape)
print("Parts shape:", df_parts.shape)

display(df_status.head())


# In[9]:


status_info = pd.DataFrame({
    'dtype': df_status.dtypes,
    'null_count': df_status.isnull().sum(),
    'null_pct': (df_status.isnull().sum() / len(df_status)) * 100,
    'unique_values': df_status.nunique()
})
display(status_info)


# In[10]:


dup_projects = df_status['project_id'].duplicated().sum()
print(f"Duplicate project_id entries: {dup_projects}")
if dup_projects > 0:
    print("Duplicate IDs:", df_status[df_status['project_id'].duplicated()]['project_id'].tolist())


# In[11]:


display(df_parts.head())

# %%
parts_info = pd.DataFrame({
    'dtype': df_parts.dtypes,
    'null_count': df_parts.isnull().sum(),
    'null_pct': (df_parts.isnull().sum() / len(df_parts)) * 100,
    'unique_values': df_parts.nunique()
})
display(parts_info)

# %%
# Check that (project_id, option_id) pairs are unique
key_groups = df_parts.groupby(['project_id', 'option_id']).size()
duplicate_keys = key_groups[key_groups > 1].shape[0]
print(f"Number of duplicate (project_id, option_id) groups: {duplicate_keys}")
if duplicate_keys > 0:
    print("Keys with duplicates:")
    print(key_groups[key_groups > 1])


# In[14]:


anomalies = []

# Critical missing fields for status quo
critical_status_fields = ['energy_demand_wh', 'energy_price_per_wh', 'base_price_per_month']
for col in critical_status_fields:
    missing = df_status[col].isnull().sum()
    if missing > 0:
        anomalies.append(f"❌ Status quo – {col} has {missing} missing values (would break cost calculation).")

# Energy demand should be > 0
negative_energy = (df_status['energy_demand_wh'] <= 0).sum()
if negative_energy > 0:
    anomalies.append(f"⚠️ {negative_energy} projects have energy_demand_wh <= 0 (impute with median?).")

# Solar angle out of plausible range [0,90]
if 'solar_angle' in df_status.columns:
    bad_angle = ((df_status['solar_angle'] < 0) | (df_status['solar_angle'] > 90)).sum()
    if bad_angle > 0:
        anomalies.append(f"⚠️ {bad_angle} rows have solar_angle outside [0,90].")

# Parts: missing component quantity or negative quantity
if 'quantity' in df_parts.columns:
    missing_qty = df_parts['quantity'].isnull().sum()
    if missing_qty > 0:
        anomalies.append(f"❌ Parts – quantity missing in {missing_qty} rows.")
    neg_qty = (df_parts['quantity'] < 0).sum()
    if neg_qty > 0:
        anomalies.append(f"⚠️ {neg_qty} rows have negative quantity.")

display(("### Detected Anomalies"))
if anomalies:
    for a in anomalies:
        display((f"- {a}"))
else:
    display(("No obvious anomalies found."))



# In[16]:


import numpy as np


# In[19]:


def compute_annual_cost(row):
    """
    Returns annual energy cost in the same currency unit as energy_price_per_wh.
    Handles missing values by returning NaN.
    """
    demand_wh = row.get('energy_demand_wh')
    price_per_wh = row.get('energy_price_per_wh')
    base_monthly = row.get('base_price_per_month')
    
    if pd.isna(demand_wh) or pd.isna(price_per_wh) or pd.isna(base_monthly):
        return np.nan
    
    annual_energy = demand_wh * price_per_wh
    annual_base = base_monthly * 12
    return annual_energy + annual_base

# Add column to status quo
df_status['annual_energy_cost_current'] = df_status.apply(compute_annual_cost, axis=1)

# Display a few rows
df_status[['project_id', 'energy_demand_wh', 'energy_price_per_wh', 'base_price_per_month', 'annual_energy_cost_current']].head()

# %% [markdown]
# ### 7. Example: Merge One Project with One Option and Show Components + Current Cost
# 
# Let's pick:
# - A specific `project_id` that exists in both files.
# - The first `option_id` for that project.

# %%


# In[21]:


common_projects = set(df_status['project_id']).intersection(set(df_parts['project_id']))
if not common_projects:
    raise ValueError("No common project_id found between status quo and parts files.")


# In[23]:


# Find a project that exists in both dataframes

example_project = list(common_projects)[2]
print(f"Using example project_id: {example_project}")

# Get status quo row for that project
status_row = df_status[df_status['project_id'] == example_project].iloc[0]

# Get all options for that project
project_options = df_parts[df_parts['project_id'] == example_project]
unique_options = project_options['option_id'].unique()
if len(unique_options) == 0:
    raise ValueError(f"No options found for project {example_project}")

example_option = unique_options[0]
print(f"Using option_id: {example_option}")

# Filter components for that option
components = project_options[project_options['option_id'] == example_option]

# %% [markdown]
# #### 7.1 List of Components for the Selected Option

# %%
# Select relevant columns to display
comp_columns = ['component_type', 'component_name', 'component_brand', 'quantity', 'quantity_units',
                'module_watt_peak', 'inverter_power_kw', 'battery_capacity_kwh', 
                'wb_charging_speed_kw', 'heatpump_nominal_power_kw']
# Keep only columns that exist
comp_columns = [col for col in comp_columns if col in components.columns]

display((f"**Components for Project {example_project}, Option {example_option}:**"))
display(components[comp_columns])

# %% [markdown]
# #### 7.2 Current Annual Energy Cost (Status Quo)

# %%
current_cost = status_row['annual_energy_cost_current']
if pd.isna(current_cost):
    print("⚠️ Cannot compute cost due to missing data in status quo.")
else:
    print(f"Current annual energy cost for project {example_project}: {current_cost:.2f} (currency units)")

# Show the detailed calculation
demand_kwh = status_row['energy_demand_wh'] / 1000.0
price_per_kwh = status_row['energy_price_per_wh'] * 1000.0
base_monthly = status_row['base_price_per_month']

print(f"\nCalculation breakdown:")
print(f"  Annual energy consumption: {demand_kwh:.0f} kWh")
print(f"  Energy price: {price_per_kwh:.4f} per kWh")
print(f"  Variable energy cost: {demand_kwh * price_per_kwh:.2f}")
print(f"  Monthly base fee: {base_monthly:.2f} → annual base: {base_monthly*12:.2f}")
print(f"  TOTAL: {current_cost:.2f}")

# %% [markdown]
# ### 8. Next Steps (Suggested)
# 
# - Fix anomalies (impute missing values, correct outliers).
# - Build a component cost table (external CSV) and join it to compute total option installation cost.
# - Project future savings using `energy_price_increase` and `base_price_increase`.
# - Add solar yield simulation (requires irradiation data per country/orientation).
# - Store cleaned data into PostgreSQL as described in the plan.


