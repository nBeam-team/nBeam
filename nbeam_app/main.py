from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text
import pandas as pd
from typing import List, Dict

app = FastAPI()

# Database config
DB_URL = "postgresql://postgres:mysecret@localhost:5432/renewable_tool"
engine = create_engine(DB_URL)

@app.get("/api/projects")
def get_projects():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT project_id, customer_contact_id FROM projects ORDER BY project_id"))
        projects = [{"project_id": row[0], "name": f"Project {row[0]} (Contact {row[1]})"} for row in result]
    return projects

@app.get("/api/project/{project_id}")
def get_project_details(project_id: str):
    # Optional: Validate that it's not empty
    if not project_id or project_id.strip() == "":
        raise HTTPException(status_code=400, detail="Project ID cannot be empty")
    
    with engine.connect() as conn:
        # If project_id in DB is integer, convert: CAST(project_id AS TEXT) = :pid
        # If it's text, just use equality
        row = conn.execute(
            text("SELECT * FROM projects WHERE CAST(project_id AS TEXT) = :pid"),
                {"pid": project_id}
        ).first()
        
        if not row:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        proj = dict(row._mapping)
        
        # Compute projection for 5 years (including year 0 as current)
        energy_demand = proj['energy_demand_kwh']
        price_init = proj['energy_price_per_kwh']
        price_rate = proj['energy_price_increase']
        base_init = proj['base_price_per_month']
        base_rate = proj['base_price_increase']
        
        years = list(range(0, 6))  # 0..5
        annual_costs = []
        monthly_costs = []
        for t in years:
            price_t = price_init * ((1 + price_rate) ** t)
            base_t = base_init * ((1 + base_rate) ** t)
            annual_t = energy_demand * price_t + base_t * 12
            annual_costs.append(round(annual_t, 2))
            monthly_costs.append(round(annual_t / 12, 2))
        
        return {
            "project_id": proj['project_id'],
            "current_annual_cost": annual_costs[0],
            "current_monthly_cost": monthly_costs[0],
            "projection_years": years,
            "projection_annual_costs": annual_costs,
            "projection_monthly_costs": monthly_costs,
            "has_solar": proj.get('has_solar', False),
            "has_storage": proj.get('has_storage', False),
            "energy_demand_kwh": energy_demand
        }

# Serve a simple HTML frontend (or use templates)
@app.get("/", response_class=HTMLResponse)
def index():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Renewable Energy Planner</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body { font-family: Arial; margin: 2rem; }
            select, button { padding: 0.5rem; font-size: 1rem; margin: 0.5rem; }
            .chart-container { width: 600px; margin-top: 2rem; }
        </style>
    </head>
    <body>
        <h1>Project Energy Cost Dashboard</h1>
        <label>Select Project:</label>
        <select id="projectSelect">
            <option value="">-- Load projects --</option>
        </select>
        <button onclick="loadProject()">Show Costs</button>

        <div id="summary" style="margin-top: 1rem;"></div>
        <div class="chart-container">
            <canvas id="costChart"></canvas>
        </div>

        <script>
            let chart;
            async function loadProjects() {
                const res = await fetch('/api/projects');
                const projects = await res.json();
                const select = document.getElementById('projectSelect');
                select.innerHTML = '<option value="">-- Select a project --</option>';
                projects.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.project_id;
                    option.textContent = p.name;
                    select.appendChild(option);
                });
            }

            async function loadProject() {
                const select = document.getElementById('projectSelect');
                const projectId = select.value;
                if (!projectId) return;

                const res = await fetch(`/api/project/${projectId}`);
                const data = await res.json();

                // Display summary
                document.getElementById('summary').innerHTML = `
                    <h3>Project ${data.project_id}</h3>
                    <p><strong>Current monthly cost:</strong> €${data.current_monthly_cost}</p>
                    <p><strong>Current annual cost:</strong> €${data.current_annual_cost}</p>
                    <p><strong>Energy demand:</strong> ${data.energy_demand_kwh} kWh/year</p>
                    <p><strong>Has solar:</strong> ${data.has_solar ? 'Yes' : 'No'}</p>
                `;

                // Update chart
                const ctx = document.getElementById('costChart').getContext('2d');
                if (chart) chart.destroy();
                chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.projection_years.map(y => y === 0 ? 'Current' : `Year ${y}`),
                        datasets: [{
                            label: 'Annual Cost (€)',
                            data: data.projection_annual_costs,
                            borderColor: 'blue',
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        title: { display: true, text: 'Projected Annual Energy Costs (5 years)' }
                    }
                });
            }

            loadProjects();
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 