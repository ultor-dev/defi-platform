import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../api';

const NODE_COLOR = {
  ADMIN: "#7c3aed",
  USER: "#0284c7",
  UNVERIFIED: "#475569",
};

export default function Graph() {
  const svgRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ nodes: 0, links: 0 });

  useEffect(() => { fetchGraph(); }, []);

  const fetchGraph = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/network/graph");
      const { nodes = [], links = [] } = res.data;
      setStats({ nodes: nodes.length, links: links.length });
      drawD3(nodes, links);
    } catch (e) {
      setError(e.response?.data?.detail || "Ошибка загрузки графа");
    } finally {
      setLoading(false);
    }
  };

  const drawD3 = (nodes, links) => {
    const container = svgRef.current?.parentElement;
    if (!container) return;

    const width = container.clientWidth || 1000;
    const height = 820;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g");

    svg.call(
      d3.zoom().scaleExtent([0.3, 3]).on("zoom", (event) => {
        g.attr("transform", event.transform);
      })
    );

    // Стрелки
    svg.append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#475569");

    // Привязываем source/target по id (address)
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const validLinks = links
      .map(l => ({
        source: typeof l.source === 'object' ? l.source.id || l.source.address : l.source,
        target: typeof l.target === 'object' ? l.target.id || l.target.address : l.target,
        amount: l.amount,
        hash: l.hash,
      }))
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(validLinks)
        .id(d => d.id)
        .distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(40));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(validLinks)
      .join("line")
      .attr("stroke", "#334155")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Nodes group
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Круги
    node.append("circle")
      .attr("r", d => d.role === "ADMIN" ? 18 : 14)
      .attr("fill", d => NODE_COLOR[d.role] || "#334155")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2);

    // Лейблы
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 28)
      .attr("font-size", 11)
      .attr("fill", "#94a3b8")
      .text(d => d.username || d.uid || "?");

    // Tooltip
    node.append("title")
      .text(d => `${d.username} (${d.role})\n${d.address?.slice(0, 10)}...${d.address?.slice(-4)}`);

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Network Graph</h1>
          <p style={s.subtitle}>Кошельки и транзакции</p>
        </div>
        <button style={s.btn} onClick={fetchGraph}>Обновить</button>
      </div>

      <div style={s.legend}>
        {Object.entries(NODE_COLOR).map(([role, color]) => (
          <div key={role} style={s.legendItem}>
            <span style={{ ...s.dot, background: color }} />
            <span>{role}</span>
          </div>
        ))}
        {!loading && (
          <span style={s.count}>{stats.nodes} узлов · {stats.links} связей</span>
        )}
      </div>

      <div style={s.wrap}>
        {loading && <div style={s.overlay}><p style={{ color: "#94a3b8" }}>Загрузка...</p></div>}
        {error && <div style={s.overlay}><p style={{ color: "#ef4444" }}>{error}</p></div>}
        <svg ref={svgRef} style={{ width: 1000, height: 800 }} />
      </div>

      <p style={s.hint}>Перетаскивайте узлы мышью. Колесо — масштаб.</p>
    </div>
  );
}

const s = {
  container: { maxWidth: 1200, margin: "0 auto", padding: "32px 16px", color: "#e2e8f0" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 700, margin: "0 0 4px", color: "#f1f5f9" },
  subtitle: { color: "#64748b", margin: 0, fontSize: 14 },
  btn: { padding: "8px 18px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 14 },
  legend: { display: "flex", alignItems: "center", gap: 20, marginBottom: 16, flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8" },
  dot: { width: 12, height: 12, borderRadius: "50%", display: "inline-block" },
  count: { fontSize: 13, color: "#475569", marginLeft: "auto" },
  wrap: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", position: "relative", minHeight: 520 },
  overlay: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", zIndex: 2 },
  hint: { fontSize: 13, color: "#475569", marginTop: 10 },
};
