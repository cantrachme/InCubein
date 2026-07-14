import React, { useRef, useEffect, useState } from "react";

const NODE_COLORS = {
  "Incubator": "#8b5cf6", // Violet
  "Startup": "#06b6d4",   // Cyan
  "Investor": "#f59e0b",  // Amber
  "Mentor": "#10b981",    // Emerald
  "Sector": "#ef4444"     // Crimson
};

export default function GraphVisualizer({ graphData }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  
  // Physics simulation state stored in refs to avoid React re-renders on every animation frame
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const dragNodeRef = useRef(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!graphData || !graphData.nodes) return;

    const canvas = canvasRef.current;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Setup initial positions in circle if they don't have coordinates
    nodesRef.current = graphData.nodes.map((node, i) => {
      const angle = (i / graphData.nodes.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 100;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: node.val ? node.val + 2 : 12
      };
    });

    // Match links to node objects
    linksRef.current = graphData.links.map(link => {
      const sourceNode = nodesRef.current.find(n => n.id === (link.source.id || link.source));
      const targetNode = nodesRef.current.find(n => n.id === (link.target.id || link.target));
      return {
        ...link,
        sourceNode,
        targetNode
      };
    }).filter(link => link.sourceNode && link.targetNode);

    // Run physics simulation and render loop
    let animationFrameId;
    
    const runSimulation = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Force Calculations
      // Gravity / Center attraction force
      for (const node of nodes) {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        node.vx += (dx / dist) * 0.05;
        node.vy += (dy / dist) * 0.05;
      }

      // Repulsion force (charge) between all pairs of nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < 280) {
            const force = (160 / (dist * dist)); // Coulomb's repulsion
            n1.vx -= dx * force;
            n1.vy -= dy * force;
            n2.vx += dx * force;
            n2.vy += dy * force;
          }
        }
      }

      // Link attraction force (spring force)
      for (const link of links) {
        const n1 = link.sourceNode;
        const n2 = link.targetNode;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const restLength = 80;
        const strength = 0.04;
        const force = (dist - restLength) * strength;
        
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        n1.vx += fx;
        n1.vy += fy;
        n2.vx -= fx;
        n2.vy -= fy;
      }

      // 2. Update Positions with velocity and drag
      for (const node of nodes) {
        if (node === dragNodeRef.current) {
          // Locked to mouse coordinates in drag mode
          continue;
        }
        
        node.vx *= 0.82; // friction
        node.vy *= 0.82;
        
        // Cap max velocity
        const maxV = 8;
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > maxV) {
          node.vx = (node.vx / speed) * maxV;
          node.vy = (node.vy / speed) * maxV;
        }
        
        node.x += node.vx;
        node.y += node.vy;
        
        // Contain within borders
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
      }

      // 3. Render Graph
      renderCanvas();
      
      animationFrameId = requestAnimationFrame(runSimulation);
    };

    runSimulation();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [graphData]);

  // Render loop function
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    // Apply pan and zoom
    ctx.translate(panOffsetRef.current.x, panOffsetRef.current.y);
    ctx.scale(zoomScale, zoomScale);

    // 1. Draw Links
    ctx.lineWidth = 1;
    for (const link of linksRef.current) {
      const isHighlighted = hoveredNode && 
        (hoveredNode.id === link.sourceNode.id || hoveredNode.id === link.targetNode.id);
        
      ctx.beginPath();
      ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
      ctx.lineTo(link.targetNode.x, link.targetNode.y);
      
      if (isHighlighted) {
        ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
        ctx.lineWidth = 2.0;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1.0;
      }
      ctx.stroke();
    }

    // 2. Draw Nodes
    for (const node of nodesRef.current) {
      const color = NODE_COLORS[node.type] || "#ffffff";
      const isHovered = hoveredNode && hoveredNode.id === node.id;
      const isSelected = selectedNode && selectedNode.id === node.id;
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      
      // Node Fill with gradient
      const grad = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, node.radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, adjustColorBrightness(color, -40));
      ctx.fillStyle = grad;
      ctx.fill();
      
      // Node Border
      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        // outer glowing ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw text label for important nodes or on hover
      const isLabelVisible = isHovered || isSelected || node.type === "Incubator" || node.val > 11;
      if (isLabelVisible) {
        ctx.font = isHovered ? "bold 11px Outfit, sans-serif" : "10px Outfit, sans-serif";
        ctx.fillStyle = isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.8)";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y - node.radius - 6);
      }
    }
    
    ctx.restore();
  };

  // Helper function to color adjust
  const adjustColorBrightness = (hex, percent) => {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);
    
    R = parseInt((R * (100 + percent)) / 100);
    G = parseInt((G * (100 + percent)) / 100);
    B = parseInt((B * (100 + percent)) / 100);
    
    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;
    
    R = R > 0 ? R : 0;
    G = G > 0 ? G : 0;
    B = B > 0 ? B : 0;
    
    const rHex = R.toString(16).padStart(2, "0");
    const gHex = G.toString(16).padStart(2, "0");
    const bHex = B.toString(16).padStart(2, "0");
    
    return `#${rHex}${gHex}${bHex}`;
  };

  // Canvas Mouse Coordinates Helper (taking into account Pan and Zoom)
  const getCanvasMouseCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    // Scale for high-resolution displays
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const xCanvas = clientX * scaleX;
    const yCanvas = clientY * scaleY;
    
    // Back out pan and zoom to get original node space coordinates
    const xNodeSpace = (xCanvas - panOffsetRef.current.x) / zoomScale;
    const yNodeSpace = (yCanvas - panOffsetRef.current.y) / zoomScale;
    
    return { x: xNodeSpace, y: yNodeSpace, rawX: xCanvas, rawY: yCanvas };
  };

  // Mouse Handlers
  const handleMouseDown = (e) => {
    const coords = getCanvasMouseCoords(e);
    
    // Check if clicked a node
    let clickedNode = null;
    for (const node of nodesRef.current) {
      const dx = coords.x - node.x;
      const dy = coords.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < node.radius + 4) {
        clickedNode = node;
        break;
      }
    }
    
    if (clickedNode) {
      dragNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      // Start panning
      isPanningRef.current = true;
      panStartRef.current = {
        x: coords.rawX - panOffsetRef.current.x,
        y: coords.rawY - panOffsetRef.current.y
      };
    }
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasMouseCoords(e);
    mousePosRef.current = coords;
    
    if (dragNodeRef.current) {
      // Update dragged node position
      dragNodeRef.current.x = coords.x;
      dragNodeRef.current.y = coords.y;
      dragNodeRef.current.vx = 0;
      dragNodeRef.current.vy = 0;
      renderCanvas();
    } else if (isPanningRef.current) {
      // Update pan offset
      panOffsetRef.current = {
        x: coords.rawX - panStartRef.current.x,
        y: coords.rawY - panStartRef.current.y
      };
      renderCanvas();
    } else {
      // Hover detection
      let hoverNode = null;
      for (const node of nodesRef.current) {
        const dx = coords.x - node.x;
        const dy = coords.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < node.radius + 4) {
          hoverNode = node;
          break;
        }
      }
      if (hoverNode !== hoveredNode) {
        setHoveredNode(hoverNode);
      }
    }
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
    isPanningRef.current = false;
  };

  // Zoom controls
  const handleZoom = (direction) => {
    setZoomScale(prev => {
      const next = direction === "in" ? prev + 0.15 : prev - 0.15;
      return Math.max(0.4, Math.min(3, next));
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    panOffsetRef.current = { x: 0, y: 0 };
    renderCanvas();
  };

  return (
    <div className="graph-viewport-container">
      {/* Zoom and Reset Controls Overlay */}
      <div className="graph-overlay-controls">
        <button className="btn btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }} onClick={() => handleZoom("in")}>＋</button>
        <button className="btn btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }} onClick={() => handleZoom("out")}>－</button>
        <button className="btn btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }} onClick={handleResetZoom}>Reset</button>
      </div>

      {/* Legend Overlay */}
      <div className="graph-legend-overlay">
        <div style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", marginBottom: "0.25rem", color: "white" }}>Graph Nodes</div>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: color }}></span>
            <span>{type}</span>
          </div>
        ))}
      </div>

      {/* Selected Node Details Box Overlay */}
      {selectedNode && (
        <div className="graph-detail-overlay">
          <button 
            style={{ float: "right", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
            onClick={() => setSelectedNode(null)}
          >
            ✕
          </button>
          <div className="graph-detail-type">{selectedNode.type}</div>
          <div className="graph-detail-title">{selectedNode.label}</div>
          
          <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
            {Object.entries(selectedNode.details || {}).map(([key, val]) => (
              <div key={key} className="graph-detail-row">
                <span>{key}</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas viewport */}
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        width={800}
        height={500}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
