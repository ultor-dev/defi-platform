import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../api';

const ROLE_COLOR = {
  ADMIN: '#f59e0b',
  USER: '#38bdf8',
  UNVERIFIED: '#64748b',
};

const KYC_RING = {
  APPROVED: '#4ade80',
  PENDING: '#fbbf24',
  REJECTED: '#ef4444',
  NONE: '#334155',
};

export default function Graph() {
  const svgRef = useRef(null);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/network/graph')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load network data'));
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = svgRef.current.clientWidth || 900;
    const height = 600;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#0f172a');

    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(50));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3')
      .attr('opacity', 0.6);

    const linkLabel = svg.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('fill', '#475569')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace')
      .text(d => d.type);

    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      )
      .on('click', (event, d) => setSelected(d));

    node.append('circle')
      .attr('r', 26)
      .attr('fill', 'none')
      .attr('stroke', d => KYC_RING[d.kyc_status] || '#334155')
      .attr('stroke-width', 3);

    node.append('circle')
      .attr('r', 22)
      .attr('fill', d => ROLE_COLOR[d.role] || '#64748b')
      .attr('opacity', 0.9)
      .attr('filter', 'url(#glow)');

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#0f172a')
      .attr('font-size', 14)
      .attr('font-weight', 'bold')
      .attr('font-family', 'Arial')
      .text(d => d.username[0].toUpperCase());

    node.append('text')
      .attr('y', 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', 11)
      .attr('font-family', 'Arial')
      .text(d => d.username);

    node.append('text')
      .attr('y', 49)
      .attr('text-anchor', 'middle')
      .attr('fill', '#475569')
      .attr('font-size', 9)
      .attr('font-family', 'monospace')
      .text(d => d.address.slice(0, 8) + '...' + d.address.slice(-4));

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [data]);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>⬡ Wallet Network Graph</h2>
        <div style={s.legend}>
          <LegendItem color="#f59e0b" label="Admin" />
          <LegendItem color="#38bdf8" label="User" />
          <LegendItem color="#64748b" label="Unverified" />
          <div style={s.divider} />
          <LegendItem color="#4ade80" label="KYC Approved" ring />
          <LegendItem color="#fbbf24" label="KYC Pending" ring />
          <LegendItem color="#ef4444" label="KYC Rejected" ring />
        </div>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.graphWrap}>
        <svg ref={svgRef} style={s.svg} />
        {selected && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <div style={{...s.avatar, background: ROLE_COLOR[selected.role]}}>
                {selected.username[0].toUpperCase()}
              </div>
              <div>
                <div style={s.panelName}>{selected.username}</div>
                <div style={s.panelRole}>{selected.role}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={s.panelBody}>
              <InfoRow label="Address" value={selected.address} mono />
              <InfoRow label="KYC Status" value={selected.kyc_status} />
              <InfoRow label="Role" value={selected.role} />
            </div>
          </div>
        )}
      </div>

      {data && (
        <div style={s.stats}>
          <span style={s.stat}>⬡ {data.nodes.length} wallets</span>
          <span style={s.stat}>⟷ {data.links.length} connections</span>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, ring }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: ring ? 'transparent' : color,
        border: ring ? `2px solid ${color}` : 'none',
      }} />
      <span style={{ color:'#94a3b8', fontSize:12 }}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color:'#64748b', fontSize:11, marginBottom:2 }}>{label}</div>
      <div style={{ color:'#f1f5f9', fontSize: mono ? 11 : 13,
        fontFamily: mono ? 'monospace' : 'Arial', wordBreak:'break-all' }}>
        {value}
      </div>
    </div>
  );
}

const s = {
  wrap: { background:'#0f172a', minHeight:'90vh', display:'flex', flexDirection:'column' },
  header: { padding:'20px 32px', borderBottom:'1px solid #1e293b',
    display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 },
  title: { color:'#38bdf8', margin:0, fontSize:18, fontWeight:700 },
  legend: { display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' },
  divider: { width:1, height:16, background:'#334155' },
  graphWrap: { flex:1, position:'relative', minHeight:600 },
  svg: { width:'100%', height:600, display:'block' },
  error: { color:'#ef4444', textAlign:'center', padding:20 },
  panel: { position:'absolute', top:16, right:16, width:280,
    background:'#1e293b', border:'1px solid #334155', borderRadius:12, padding:16 },
  panelHeader: { display:'flex', alignItems:'center', gap:12, marginBottom:16 },
  avatar: { width:40, height:40, borderRadius:'50%', display:'flex',
    alignItems:'center', justifyContent:'center', color:'#0f172a',
    fontWeight:700, fontSize:16, flexShrink:0 },
  panelName: { color:'#f1f5f9', fontWeight:600, fontSize:14 },
  panelRole: { color:'#64748b', fontSize:12 },
  closeBtn: { marginLeft:'auto', background:'none', border:'none',
    color:'#64748b', cursor:'pointer', fontSize:16 },
  panelBody: {},
  stats: { padding:'12px 32px', borderTop:'1px solid #1e293b', display:'flex', gap:24 },
  stat: { color:'#475569', fontSize:13 },
};
