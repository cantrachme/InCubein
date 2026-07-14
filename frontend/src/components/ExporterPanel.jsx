import React from "react";
import { Download, FileJson, FileSpreadsheet, Database, Network } from "lucide-react";

export default function ExporterPanel() {
  const triggerDownload = (format) => {
    window.open(`http://127.0.0.1:8000/api/export/${format}`, "_blank");
  };

  return (
    <div className="glass-card" style={{ padding: "2.5rem" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
        📥 Export Ecosystem Database
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "2rem" }}>
        Download the cleaned, resolved, and AI-enriched ecosystem data in relational, graph, hierarchical, or document-ready database formats.
      </p>

      <div className="exporter-grid">
        {/* CSV Export */}
        <div className="glass-card exporter-card">
          <div className="exporter-icon">
            <FileSpreadsheet size={24} />
          </div>
          <div className="exporter-info">
            <div className="exporter-name">Zipped CSV Archives</div>
            <div className="exporter-desc">
              Download separate CSV archives for <b>incubators.csv</b>, <b>startups.csv</b>, <b>mentors.csv</b>, <b>investors.csv</b>, and <b>relationships.csv</b>.
            </div>
            <button className="btn btn-primary" onClick={() => triggerDownload("csv")}>
              <Download size={14} /> Download ZIP
            </button>
          </div>
        </div>

        {/* JSON Export */}
        <div className="glass-card exporter-card">
          <div className="exporter-icon">
            <FileJson size={24} />
          </div>
          <div className="exporter-info">
            <div className="exporter-name">Combined ecosystem JSON</div>
            <div className="exporter-desc">
              Hierarchical JSON tree showing full node-link structure, suitable for custom d3 mapping, Elasticsearch, or vector data ingestion.
            </div>
            <button className="btn btn-primary" onClick={() => triggerDownload("json")}>
              <Download size={14} /> Download JSON
            </button>
          </div>
        </div>

        {/* MongoDB Script */}
        <div className="glass-card exporter-card">
          <div className="exporter-icon">
            <Database size={24} />
          </div>
          <div className="exporter-info">
            <div className="exporter-name">MongoDB Collection Import</div>
            <div className="exporter-desc">
              Javascript script file containing ready-to-run queries to initialize, drop, and insert collection items in MongoDB.
            </div>
            <button className="btn btn-primary" onClick={() => triggerDownload("mongodb")}>
              <Download size={14} /> Download JS Script
            </button>
          </div>
        </div>

        {/* Neo4j Cypher Script */}
        <div className="glass-card exporter-card">
          <div className="exporter-icon">
            <Network size={24} />
          </div>
          <div className="exporter-info">
            <div className="exporter-name">Neo4j Cypher Script</div>
            <div className="exporter-desc">
              Cypher import script setting up database constraints, building nodes (Incubator, Startup, Investor), and merging graph relationship edges.
            </div>
            <button className="btn btn-primary" onClick={() => triggerDownload("neo4j")}>
              <Download size={14} /> Download Cypher Script
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
