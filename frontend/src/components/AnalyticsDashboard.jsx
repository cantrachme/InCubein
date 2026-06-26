import React from "react";
import { ShieldCheck, MapPin, Building, Layers } from "lucide-react";

export default function AnalyticsDashboard({ analyticsData, loading }) {
  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading ecosystem analytics data...</p>
      </div>
    );
  }

  if (!analyticsData || !analyticsData.totals) {
    return (
      <div className="empty-state">
        <h3>No Data Found</h3>
        <p>Run the scraping pipeline to collect and analyze Indian startup ecosystem data.</p>
      </div>
    );
  }

  const { totals, state_distribution, region_distribution, top_hubs, sector_distribution, top_incubators, funding_stages } = analyticsData;

  // Max value calculators for bar percentage mapping
  const maxStateVal = state_distribution && state_distribution.length > 0 ? state_distribution[0].count : 1;
  const maxRegionVal = region_distribution && region_distribution.length > 0 ? region_distribution[0].count : 1;
  const maxSectorVal = sector_distribution && sector_distribution.length > 0 ? sector_distribution[0].count : 1;
  const maxHubVal = top_hubs && top_hubs.length > 0 ? top_hubs[0].count : 1;

  return (
    <div>
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Incubators</span>
            <span className="metric-icon"><ShieldCheck size={20} /></span>
          </div>
          <div className="metric-value">{totals.incubators}</div>
          <div className="metric-footer">Active innovation hubs</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">States Covered</span>
            <span className="metric-icon"><MapPin size={20} /></span>
          </div>
          <div className="metric-value">{totals.states}</div>
          <div className="metric-footer">Unique Indian states</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Cities Covered</span>
            <span className="metric-icon"><Building size={20} /></span>
          </div>
          <div className="metric-value">{totals.cities}</div>
          <div className="metric-footer">Active urban hubs</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Sectors Supported</span>
            <span className="metric-icon"><Layers size={20} /></span>
          </div>
          <div className="metric-value">{totals.sectors}</div>
          <div className="metric-footer">Focus technology verticals</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {/* Incubator Sector Representation */}
        <div className="glass-card chart-card">
          <h3>💡 Top Incubator Sectors</h3>
          <div className="bar-chart-container" style={{ marginTop: "1rem" }}>
            {sector_distribution && sector_distribution.slice(0, 7).map((sector) => (
              <div key={sector.sector} className="bar-wrapper">
                <div className="bar-label">{sector.sector}</div>
                <div className="bar-track">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${(sector.count / maxSectorVal) * 100}%`,
                      background: "linear-gradient(90deg, #06b6d4, #38bdf8)"
                    }}
                  />
                </div>
                <div className="bar-value">{sector.count}</div>
              </div>
            ))}
            {(!sector_distribution || sector_distribution.length === 0) && <p style={{ color: "var(--text-dim)" }}>No incubator sectors found.</p>}
          </div>
        </div>

        {/* Region-wise Distribution */}
        <div className="glass-card chart-card">
          <h3>🌐 Regional Distribution</h3>
          <div className="bar-chart-container" style={{ marginTop: "1rem" }}>
            {region_distribution && region_distribution.map((region) => (
              <div key={region.region} className="bar-wrapper">
                <div className="bar-label">{region.region}</div>
                <div className="bar-track">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${(region.count / maxRegionVal) * 100}%`,
                      background: "linear-gradient(90deg, #8b5cf6, #c084fc)"
                    }}
                  />
                </div>
                <div className="bar-value">{region.count}</div>
              </div>
            ))}
            {(!region_distribution || region_distribution.length === 0) && <p style={{ color: "var(--text-dim)" }}>No regional distribution data available.</p>}
          </div>
        </div>

        {/* State-wise Distribution */}
        <div className="glass-card chart-card">
          <h3>📍 Incubator Density by State</h3>
          <div className="bar-chart-container" style={{ marginTop: "1rem" }}>
            {state_distribution && state_distribution.slice(0, 7).map((state) => (
              <div key={state.state} className="bar-wrapper">
                <div className="bar-label">{state.state}</div>
                <div className="bar-track">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${(state.count / maxStateVal) * 100}%`,
                      background: "linear-gradient(90deg, #ef4444, #f87171)"
                    }}
                  />
                </div>
                <div className="bar-value">{state.count}</div>
              </div>
            ))}
            {(!state_distribution || state_distribution.length === 0) && <p style={{ color: "var(--text-dim)" }}>No state distribution statistics available.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
