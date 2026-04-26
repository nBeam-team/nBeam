import csv
from collections import defaultdict

dir1 = r"c:\Users\gopal\jsk_bigberlin\nBeam\nbeam_app\Project_Data\2a8ba8e2"
dir2 = r"c:\Users\gopal\jsk_bigberlin\nBeam\nbeam_app\Project_Data\23c108b7"

def analyze_dir(d):
    print(f"Analyzing {d}")
    
    de_projects = set()
    with open(d + r"\projects_status_quo.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("country") == "Germany":
                de_projects.add(row["project_id"])
                
    ses_options = set()
    with open(d + r"\project_options_parts.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["project_id"] in de_projects:
                if row["technology"] == "ses" or (row.get("battery_capacity_kwh") and float(row["battery_capacity_kwh"]) > 0):
                    ses_options.add((row["project_id"], row["option_id"]))
                    
    print(f"Total Germany Solar+Battery options: {len(ses_options)}")
    
    summary = defaultdict(list)
    with open(d + r"\project_options_parts.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row["project_id"], row["option_id"]) in ses_options:
                key = (row["line_item_function"], row["component_type"], row["component_name"])
                try:
                    qty = float(row["quantity"])
                    summary[key].append(qty)
                except:
                    pass
                    
    print("Common components:")
    for k, v in summary.items():
        if len(v) > 0:
            print(f"{k}: count={len(v)}, avg_qty={sum(v)/len(v):.2f}, min={min(v)}, max={max(v)}")
    print("-" * 50)

analyze_dir(dir1)
analyze_dir(dir2)
