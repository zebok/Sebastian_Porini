export type ConstructionMode = "blueprint3d" | "lemniscate" | "compass";

export interface ConstructionNode {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  baseRadius: number;
  color: string;
  group: number;
  angleOffset: number;
  radiusMultiplier: number;
}

// ─── THEME COLORS ────────────────────────────────────────────────────────────

const THEME = {
  accent: { r: 45, g: 91, b: 227 },    // Royal Blue
  accent2: { r: 124, g: 58, b: 237 },  // Purple
  accent3: { r: 5, g: 150, b: 105 },   // Green
  gold: { r: 217, g: 119, b: 6 },      // Warm Amber / Blueprint Brass
};

const getRGBA = (c: { r: number; g: number; b: number }, alpha: number) =>
  `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(1, alpha))})`;

// ─── 1. BLUEPRINT 3D ICOSAHEDRON GEOMETRY ────────────────────────────────────

const PHI = (1 + Math.sqrt(5)) / 2; // Golden Ratio ~1.618

const ICOSAHEDRON_VERTICES_3D: [number, number, number][] = [
  [-1,  PHI, 0],
  [ 1,  PHI, 0],
  [-1, -PHI, 0],
  [ 1, -PHI, 0],
  [0, -1,  PHI],
  [0,  1,  PHI],
  [0, -1, -PHI],
  [0,  1, -PHI],
  [ PHI, 0, -1],
  [ PHI, 0,  1],
  [-PHI, 0, -1],
  [-PHI, 0,  1],
];

// Normalize vertices to unit sphere
const NORMALIZED_VERTICES = ICOSAHEDRON_VERTICES_3D.map(([x, y, z]) => {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len] as [number, number, number];
});

// Build icosahedron edges (distance between connected vertices is ~1.05 on unit sphere)
const ICOSAHEDRON_EDGES: [number, number][] = [];
for (let i = 0; i < NORMALIZED_VERTICES.length; i++) {
  for (let j = i + 1; j < NORMALIZED_VERTICES.length; j++) {
    const [x1, y1, z1] = NORMALIZED_VERTICES[i];
    const [x2, y2, z2] = NORMALIZED_VERTICES[j];
    const d = Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    if (d < 1.15) {
      ICOSAHEDRON_EDGES.push([i, j]);
    }
  }
}

// ─── TARGET CALCULATORS ─────────────────────────────────────────────────────

export const setConstructionTargets = (
  nodes: ConstructionNode[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  mode: ConstructionMode,
  frameCount: number,
  mouse: { x: number; y: number; active: boolean }
) => {
  const nodeCount = nodes.length;
  // Posicionar la figura en el tercio superior/medio para despejar completamente el texto inferior
  const centerY = Math.max(150, Math.min(h * 0.38, cy - 50));
  const centerX = cx;

  // Sutil influencia del cursor
  let mx = 0;
  let my = 0;
  if (mouse.active) {
    mx = (mouse.x - cx) / w;
    my = (mouse.y - cy) / h;
  }

  // ─── MODE A: BLUEPRINT 3D ─────────────────────────────────────────────────
  if (mode === "blueprint3d") {
    const scale = Math.min(w, h) * (w < 768 ? 0.20 : 0.24);
    const yaw = frameCount * 0.007 + mx * 0.8;
    const pitch = Math.sin(frameCount * 0.004) * 0.25 + 0.35 + my * 0.8;
    const roll = frameCount * 0.002;

    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const cosR = Math.cos(roll), sinR = Math.sin(roll);

    // Project 12 vertices
    const projectedVertices: { x: number; y: number; z: number }[] = NORMALIZED_VERTICES.map(([vx, vy, vz]) => {
      const x1 = vx * cosY - vz * sinY;
      const y1 = vy;
      const z1 = vx * sinY + vz * cosY;

      const x2 = x1;
      const y2 = y1 * cosP - z1 * sinP;
      const z2 = y1 * sinP + z1 * cosP;

      const x3 = x2 * cosR - y2 * sinR;
      const y3 = x2 * sinR + y2 * cosR;
      const z3 = z2;

      const fov = 400;
      const pScale = fov / (fov + z3 * scale * 0.6);

      return {
        x: centerX + x3 * scale * pScale,
        y: centerY + y3 * scale * pScale,
        z: z3,
      };
    });

    nodes.forEach((node, i) => {
      if (i < 12) {
        const v = projectedVertices[i];
        node.tx = v.x;
        node.ty = v.y;
        return;
      }

      const edgeParticles = 120;
      if (i < 12 + edgeParticles) {
        const edgeIdx = (i - 12) % ICOSAHEDRON_EDGES.length;
        const [v1Idx, v2Idx] = ICOSAHEDRON_EDGES[edgeIdx];
        const v1 = projectedVertices[v1Idx];
        const v2 = projectedVertices[v2Idx];
        const t = ((i - 12) / ICOSAHEDRON_EDGES.length) % 1;
        
        node.tx = v1.x + (v2.x - v1.x) * t;
        node.ty = v1.y + (v2.y - v1.y) * t;
        return;
      }

      const assemblyCycle = (frameCount * 0.01 + i * 0.12) % 1.0;
      const targetVertexIdx = i % 12;
      const targetV = projectedVertices[targetVertexIdx];

      const orbitRadius = scale * (1.6 + 0.8 * Math.sin(node.angleOffset + frameCount * 0.005));
      const orbitAngle = node.angleOffset + frameCount * 0.008;
      const originX = centerX + Math.cos(orbitAngle) * orbitRadius;
      const originY = centerY + Math.sin(orbitAngle) * orbitRadius;

      node.tx = originX + (targetV.x - originX) * assemblyCycle;
      node.ty = originY + (targetV.y - originY) * assemblyCycle;
    });
    return;
  }

  // ─── MODE B: LEMNISCATE / INFINITO ─────────────────────────────────────────
  if (mode === "lemniscate") {
    // Escala armónica balanceada
    const a = Math.min(w, h) * (w < 768 ? 0.28 : 0.32);
    // Velocidad pausada, reflexiva y serena (Tiempo, Paciencia y Constancia)
    const speed = 0.0016;
    const tilt = 0.14 + Math.sin(frameCount * 0.001) * 0.05 + my * 0.12;

    nodes.forEach((node, i) => {
      // Distribución uniforme de las partículas a lo largo del recorrido continuo [0, 2PI]
      const phase = (i / nodeCount) * Math.PI * 2;
      const t = (phase + frameCount * speed) % (Math.PI * 2);

      // Ecuación paramétrica de la Lemniscata de Bernoulli:
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const lx = (a * Math.SQRT2 * Math.cos(t)) / denom;
      const ly = (a * Math.SQRT2 * Math.sin(t) * Math.cos(t)) / denom;

      // Ondulación 3D suave y respiración armónica
      const zOffset = Math.sin(t * 2 + frameCount * 0.0015) * 20;
      const wave = Math.sin(frameCount * 0.008 + i * 0.12) * 1.8;

      const rotX = lx * Math.cos(tilt) - ly * Math.sin(tilt);
      const rotY = lx * Math.sin(tilt) + ly * Math.cos(tilt) + zOffset * 0.22;

      // Interacción sutil con el mouse
      let mousePushX = 0;
      let mousePushY = 0;
      if (mouse.active) {
        const dx = (centerX + rotX) - mouse.x;
        const dy = (centerY + rotY) - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 90) {
          const force = (90 - dist) / 90;
          mousePushX = (dx / dist) * force * 12;
          mousePushY = (dy / dist) * force * 12;
        }
      }

      node.tx = centerX + rotX + wave * Math.cos(node.angleOffset) + mousePushX;
      node.ty = centerY + rotY + wave * Math.sin(node.angleOffset) + mousePushY;
    });
    return;
  }



  // ─── MODE C: COMPASS / TRAZO RADIAL DE ARQUITECTO ─────────────────────────
  if (mode === "compass") {
    const baseR = Math.min(w, h) * (w < 768 ? 0.26 : 0.32);
    const sweepAngle = (frameCount * 0.011) % (Math.PI * 2);

    const radii = [
      baseR * 0.28,  // Inner Core Ring (Objetivo)
      baseR * 0.58,  // Intermediate Construction Ring
      baseR * 0.88,  // Main Blueprint Ring
      baseR * 1.15,  // Outer Guide Ring
    ];

    nodes.forEach((node, i) => {
      // 1. Center Pivot & Compass Needle Tip (first 8 nodes)
      if (i === 0) {
        node.tx = centerX;
        node.ty = centerY;
        return;
      }
      if (i < 8) {
        // Needle line from center to outer ring tip
        const needleFrac = i / 8;
        const needleR = radii[3] * needleFrac;
        node.tx = centerX + Math.cos(sweepAngle) * needleR;
        node.ty = centerY + Math.sin(sweepAngle) * needleR;
        return;
      }

      // 2. 12 Radial Spokes (Precision Blueprint Tick Marks)
      const ringGroup = i % 4;
      const targetR = radii[ringGroup];

      // Particles are positioned along the concentric rings
      const localAngle = (i / (nodeCount / 4)) * Math.PI * 2 + Math.sin(frameCount * 0.003 + ringGroup) * 0.05;
      
      // Dynamic breathing ripple when sweep angle passes the particle
      const angleDiff = Math.abs(((localAngle - sweepAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const isNearSweep = angleDiff < 0.3;
      const ripple = isNearSweep ? Math.sin(frameCount * 0.08) * 5.5 : 0;

      const r = targetR + ripple;
      node.tx = centerX + Math.cos(localAngle) * r;
      node.ty = centerY + Math.sin(localAngle) * r;
    });
  }
};

// ─── MAIN RENDER FUNCTION ────────────────────────────────────────────────────

export const renderConstructionParticles = (
  ctx: CanvasRenderingContext2D,
  nodes: ConstructionNode[],
  w: number,
  h: number,
  mode: ConstructionMode,
  frameCount: number
) => {


  const cx = w / 2;
  const cy = Math.max(150, Math.min(h * 0.38, (h / 2) - 50));
  const nodeCount = nodes.length;

  ctx.save();

  // ─── 1. RENDER MODE A: BLUEPRINT 3D ────────────────────────────────────────
  if (mode === "blueprint3d") {
    // A. Draw glowing wireframe edges between the 12 vertices
    ctx.setLineDash([3, 5]);
    for (let e = 0; e < ICOSAHEDRON_EDGES.length; e++) {
      const [i1, i2] = ICOSAHEDRON_EDGES[e];
      const n1 = nodes[i1];
      const n2 = nodes[i2];
      if (!n1 || !n2) continue;

      const edgeLength = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      const alpha = Math.max(0.12, Math.min(0.55, 120 / (edgeLength + 0.1)));

      // Gradient wireframe stroke
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = getRGBA(THEME.accent, alpha * 0.7);
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();

      // Energy pulse bead traveling along the edge
      const pulseProg = (frameCount * 0.008 + e * 0.2) % 1.0;
      const px = n1.x + (n2.x - n1.x) * pulseProg;
      const py = n1.y + (n2.y - n1.y) * pulseProg;

      ctx.fillStyle = getRGBA(THEME.accent2, alpha * 0.85);
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);

    // B. Draw center core anchor beacon
    const corePulse = 0.5 + 0.5 * Math.sin(frameCount * 0.04);
    ctx.fillStyle = getRGBA(THEME.accent, 0.15 * corePulse);
    ctx.beginPath();
    ctx.arc(cx, cy, 32 + corePulse * 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = getRGBA(THEME.accent, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();

    // C. Draw the nodes (Vertices + structural particles)
    nodes.forEach((node, i) => {
      const isVertex = i < 12;
      const isIncoming = i >= 132;

      let radius = node.baseRadius;
      let alpha = 0.45;
      let color = THEME.accent;

      if (isVertex) {
        radius = 4.2 + Math.sin(frameCount * 0.05 + i) * 1.2;
        alpha = 0.9;
        color = THEME.accent2;

        // Vertex halo
        ctx.fillStyle = getRGBA(color, 0.18);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (isIncoming) {
        radius = 1.6;
        alpha = 0.35;
        color = THEME.accent3;
      }

      ctx.fillStyle = getRGBA(color, alpha);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ─── 2. RENDER MODE B: LEMNISCATE / INFINITO ───────────────────────────────
  else if (mode === "lemniscate") {
    // A. Filamentos elásticos conectando la corriente continua de partículas a lo largo del listón
    ctx.lineWidth = 1.0;
    const step = Math.max(1, Math.floor(nodeCount / 180));
    for (let i = 0; i < nodeCount - step; i += step) {
      const n1 = nodes[i];
      const n2 = nodes[i + step];
      const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      if (dist < 42) {
        const alpha = (1 - dist / 42) * 0.35;
        const color = (i % 2 === 0) ? THEME.accent : THEME.accent2;
        ctx.strokeStyle = getRGBA(color, alpha);
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      }
    }

    // B. Cruce orgánico en el centro: filamentos finos cuando partículas de ramas opuestas se cruzan
    for (let i = 0; i < nodeCount; i += 6) {
      const n1 = nodes[i];
      const distToCenter = Math.hypot(n1.x - cx, n1.y - cy);
      if (distToCenter < 35) {
        for (let j = i + 30; j < nodeCount; j += 8) {
          const n2 = nodes[j];
          const dNodes = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          if (dNodes < 24) {
            const alpha = (1 - dNodes / 24) * 0.22;
            ctx.strokeStyle = getRGBA(THEME.accent2, alpha);
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }
    }

    // C. Dibujo de Partículas en la Corriente continua
    nodes.forEach((node, i) => {
      const distToCenter = Math.hypot(node.x - cx, node.y - cy);
      const isNearCenter = distToCenter < 45;
      
      const radius = node.baseRadius * (isNearCenter ? 1.25 : 1.0);
      const alpha = isNearCenter ? 0.8 : 0.45;
      const color = (i % 3 === 0) ? THEME.accent : (i % 3 === 1) ? THEME.accent2 : THEME.accent3;

      ctx.fillStyle = getRGBA(color, alpha);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }



  // ─── 3. RENDER MODE C: COMPASS / TRAZO RADIAL DE ARQUITECTO ────────────────
  else if (mode === "compass") {
    const baseR = Math.min(w, h) * (w < 768 ? 0.26 : 0.32);
    const sweepAngle = (frameCount * 0.011) % (Math.PI * 2);

    const radii = [
      baseR * 0.28,
      baseR * 0.58,
      baseR * 0.88,
      baseR * 1.15,
    ];

    // A. Draw Blueprint Drafting Circles & Guidelines
    radii.forEach((r, idx) => {
      // Thin concentric guide circles
      ctx.strokeStyle = getRGBA(THEME.accent, idx === 2 ? 0.25 : 0.12);
      ctx.lineWidth = idx === 2 ? 1.4 : 0.8;
      ctx.setLineDash(idx === 1 || idx === 3 ? [4, 6] : []);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Trailing illuminated arc drawn by the compass needle
      ctx.strokeStyle = getRGBA(THEME.accent2, 0.45);
      ctx.lineWidth = 2.0;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, sweepAngle - Math.PI * 0.65, sweepAngle);
      ctx.stroke();
    });

    // B. Draw 12 Radial Axes (Technical Blueprint Grid)
    ctx.setLineDash([2, 8]);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = getRGBA(THEME.accent, 0.12);
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * radii[3], cy + Math.sin(ang) * radii[3]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // C. Draw Compass Needle (Beam of Time & Construction)
    const tipX = cx + Math.cos(sweepAngle) * radii[3];
    const tipY = cy + Math.sin(sweepAngle) * radii[3];

    // Glowing beam
    const needleGrad = ctx.createLinearGradient(cx, cy, tipX, tipY);
    needleGrad.addColorStop(0, getRGBA(THEME.accent, 0.8));
    needleGrad.addColorStop(0.7, getRGBA(THEME.accent2, 0.5));
    needleGrad.addColorStop(1, getRGBA(THEME.accent3, 0.95));

    ctx.strokeStyle = needleGrad;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Compass Tip Glow
    ctx.fillStyle = getRGBA(THEME.accent3, 0.95);
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = getRGBA(THEME.accent3, 0.25);
    ctx.beginPath();
    ctx.arc(tipX, tipY, 9.0, 0, Math.PI * 2);
    ctx.fill();

    // D. Pivot Core (Objetivo)
    const pivotPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05);
    ctx.fillStyle = getRGBA(THEME.accent, 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, 4.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = getRGBA(THEME.accent, 0.4 * pivotPulse);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12 + pivotPulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    // E. Draw Nodes along Arcs with Sweep Brightness
    nodes.forEach((node) => {
      const nodeAngle = Math.atan2(node.y - cy, node.x - cx);
      const angleDiff = Math.abs(((nodeAngle - sweepAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const isLitByNeedle = angleDiff < 0.45;

      const radius = node.baseRadius * (isLitByNeedle ? 1.6 : 1.0);
      const alpha = isLitByNeedle ? 0.85 : 0.32;
      const color = isLitByNeedle ? THEME.accent2 : THEME.accent;

      ctx.fillStyle = getRGBA(color, alpha);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

  }

  ctx.restore();
};
