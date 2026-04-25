// src/components/ProjectDashboard.tsx
import { useEffect, useState } from 'react';

interface Project {
  project_id: string;
  name: string;
}

interface ProjectDetail {
  project_id: string;
  current_annual_cost: number;
  current_monthly_cost: number;
  projection_years: number[];
  projection_annual_costs: number[];
  projection_monthly_costs: number[];
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error('Failed to load projects', err));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetch(`/api/project/${selectedId}`)
      .then(res => res.json())
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load project details', err);
        setLoading(false);
      });
  }, [selectedId]);

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
      <h1 className="text-2xl font-bold mb-6">Project Energy Cost Dashboard</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select a project
        </label>
        <select
          className="w-full border border-gray-300 rounded-md p-2 bg-white"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">-- Choose a project --</option>
          {projects.map((p) => (
            <option key={p.project_id} value={p.project_id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading project data...</div>}

      {detail && !loading && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3">Project {detail.project_id}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Current monthly cost</p>
                <p className="text-2xl font-bold text-green-600">
                  €{detail.current_monthly_cost}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current annual cost</p>
                <p className="text-2xl font-bold text-green-600">
                  €{detail.current_annual_cost}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Projection (5 years)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Year</th>
                    <th className="px-4 py-2 text-left">Annual Cost (€)</th>
                    <th className="px-4 py-2 text-left">Monthly Cost (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.projection_years.map((year, idx) => (
                    <tr key={year} className="border-t">
                      <td className="px-4 py-2">{year === 0 ? 'Current' : `Year ${year}`}</td>
                      <td className="px-4 py-2">€{detail.projection_annual_costs[idx]}</td>
                      <td className="px-4 py-2">€{detail.projection_monthly_costs[idx]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!detail && !loading && selectedId === '' && (
        <div className="text-center py-12 text-gray-400">
          Select a project from the dropdown above.
        </div>
      )}
    </div>
  );
}