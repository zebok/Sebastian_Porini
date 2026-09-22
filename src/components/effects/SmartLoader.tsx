"use client";

import { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import styles from "./SmartLoader.module.css";

const phi = (1 + Math.sqrt(5)) / 2;
const vertices3D: [number, number, number][] = [
  [-1,  phi,  0], [ 1,  phi,  0], [-1, -phi,  0], [ 1, -phi,  0],
  [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
  [ phi,  0, -1], [ phi,  0,  1], [-phi,  0, -1], [-phi,  0,  1]
];

// Helper to compute edges of an icosahedron
const edges: [number, number][] = [];
for (let i = 0; i < vertices3D.length; i++) {
  for (let j = i + 1; j < vertices3D.length; j++) {
    const dx = vertices3D[i][0] - vertices3D[j][0];
    const dy = vertices3D[i][1] - vertices3D[j][1];
    const dz = vertices3D[i][2] - vertices3D[j][2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (Math.abs(distSq - 4) < 0.1) {
      edges.push([i, j]);
    }
  }
}

interface SmartLoaderProps {
  onComplete: () => void;
}

export default function SmartLoader({ onComplete }: SmartLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("");
  const anglesRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number | null>(null);

  // References to raw DOM nodes for zero-render updates
  const circleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  useEffect(() => {
    // 1. Simular progreso de carga con GSAP
    const obj = { val: 0 };
    const timeline = gsap.to(obj, {
      val: 100,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: () => {
        const rounded = Math.floor(obj.val);
        setProgress(rounded);

        // Actualizar textos según progreso
        if (rounded < 30) {
          setLoadingText("INITIALIZING NEURAL NETWORKS...");
        } else if (rounded < 65) {
          setLoadingText("CONSTRUCTING COGNITIVE CONSTELLATION...");
        } else if (rounded < 95) {
          setLoadingText("MAPPING KNOWLEDGE NODES...");
        } else {
          setLoadingText("COGNITION ACTIVE.");
        }
      },
      onComplete: () => {
        // Animar salida del loader completo
        gsap.to(containerRef.current, {
          opacity: 0,
          scale: 1.05,
          duration: 0.8,
          ease: "power3.inOut",
          onComplete: () => {
            onComplete();
          }
        });
      }
    });

    return () => {
      timeline.kill();
    };
  }, [onComplete]);

  // 2. Loop de animación 3D
  useEffect(() => {
    const handleAnimate = () => {
      // Incrementar rotación lentamente
      anglesRef.current.x += 0.005;
      anglesRef.current.y += 0.008;

      const cosX = Math.cos(anglesRef.current.x);
      const sinX = Math.sin(anglesRef.current.x);
      const cosY = Math.cos(anglesRef.current.y);
      const sinY = Math.sin(anglesRef.current.y);

      const cx = 200;
      const cy = 200;
      const scaleFactor = 90;

      // Calcular posiciones proyectadas de los vértices
      const projected = vertices3D.map(([x, y, z]) => {
        // Rotar Y
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotar X
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // Proyección simple
        const depth = 3;
        const perspective = depth / (depth + z2);
        const px = cx + x1 * scaleFactor * perspective;
        const py = cy + y2 * scaleFactor * perspective;

        return { x: px, y: py, z: z2 };
      });

      // Escribir directamente en el DOM para máximo rendimiento (60fps sin re-renders de React)
      projected.forEach((p, idx) => {
        const circle = circleRefs.current[idx];
        if (circle) {
          circle.setAttribute("cx", p.x.toString());
          circle.setAttribute("cy", p.y.toString());

          // Escalar tamaño y opacidad según profundidad Z
          const baseRadius = 5;
          const zDepth = (p.z + phi) / (2 * phi); // Normalizar entre 0 y 1
          const r = baseRadius * (1.3 - zDepth * 0.6);
          const opacity = 1 - zDepth * 0.7;

          circle.setAttribute("r", r.toString());
          circle.setAttribute("style", `opacity: ${opacity}; fill: var(--accent);`);
        }
      });

      // Dibujar líneas y aplicar progreso
      edges.forEach(([u, v], idx) => {
        const line = lineRefs.current[idx];
        if (line) {
          const p1 = projected[u];
          const p2 = projected[v];
          line.setAttribute("x1", p1.x.toString());
          line.setAttribute("y1", p1.y.toString());
          line.setAttribute("x2", p2.x.toString());
          line.setAttribute("y2", p2.y.toString());

          // El progreso de carga determina cuántas líneas se dibujan y su dashoffset
          const lineThreshold = (idx / edges.length) * 100;
          let opacity = 0;

          if (progress > lineThreshold) {
            // Promediar profundidad Z de los dos extremos
            const avgZ = (p1.z + p2.z) / 2;
            const zDepth = (avgZ + phi) / (2 * phi);
            opacity = (1 - zDepth * 0.8) * 0.4;
          }

          line.setAttribute("style", `opacity: ${opacity}; stroke: var(--accent-2); stroke-width: 1px;`);
        }
      });

      requestRef.current = requestAnimationFrame(handleAnimate);
    };

    requestRef.current = requestAnimationFrame(handleAnimate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [progress]);

  return (
    <div className={styles.overlay} ref={containerRef}>
      <div className={styles.loaderContainer}>
        {/* SVG de la Esfera Geodésica en 3D */}
        <div className={styles.svgWrapper}>
          <svg viewBox="0 0 400 400" className={styles.loaderSvg} ref={svgRef}>
            {/* Dibujar Aristas */}
            <g>
              {edges.map((_, idx) => (
                <line
                  key={`edge-${idx}`}
                  ref={(el) => {
                    lineRefs.current[idx] = el;
                  }}
                  className={styles.edgeLine}
                />
              ))}
            </g>
            {/* Dibujar Vértices */}
            <g>
              {vertices3D.map((_, idx) => (
                <circle
                  key={`vert-${idx}`}
                  ref={(el) => {
                    circleRefs.current[idx] = el;
                  }}
                  className={styles.nodeCircle}
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Cifras de Progreso y Mensaje */}
        <div className={styles.progressText}>
          <span className={styles.number}>{progress.toString().padStart(3, "0")}%</span>
          <span className={styles.label}>{loadingText}</span>
        </div>
      </div>
    </div>
  );
}
