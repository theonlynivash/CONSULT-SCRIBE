import { useEffect, useRef } from 'react';

type Circle = {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export default function Particles({
  color = '#f2b705',
  quantity = 56,
  size = 0.7,
}: {
  color?: string;
  quantity?: number;
  size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rgb = hexToRgb(color);
    const circles: Circle[] = [];
    const mouse = { x: 0, y: 0 };
    const canvasSize = { w: 0, h: 0 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let resizeTimer = 0;

    function circleParams(): Circle {
      return {
        x: Math.random() * canvasSize.w,
        y: Math.random() * canvasSize.h,
        translateX: 0,
        translateY: 0,
        size: Math.random() * 1.6 + size,
        alpha: 0,
        targetAlpha: Math.random() * 0.45 + 0.12,
        dx: (Math.random() - 0.5) * 0.18,
        dy: (Math.random() - 0.5) * 0.18,
        magnetism: 0.15 + Math.random() * 3.2,
      };
    }

    function resize() {
      canvasSize.w = container.offsetWidth;
      canvasSize.h = container.offsetHeight;
      canvas.width = canvasSize.w * dpr;
      canvas.height = canvasSize.h * dpr;
      canvas.style.width = `${canvasSize.w}px`;
      canvas.style.height = `${canvasSize.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      circles.length = 0;
      for (let i = 0; i < quantity; i += 1) circles.push(circleParams());
    }

    function onMouseMove(event: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left - canvasSize.w / 2;
      mouse.y = event.clientY - rect.top - canvasSize.h / 2;
    }

    function drawCircle(circle: Circle) {
      ctx.save();
      ctx.translate(circle.translateX, circle.translateY);
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${circle.alpha})`;
      ctx.fill();
      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
      for (let i = 0; i < circles.length; i += 1) {
        const circle = circles[i];
        const edges = [
          circle.x + circle.translateX - circle.size,
          canvasSize.w - circle.x - circle.translateX - circle.size,
          circle.y + circle.translateY - circle.size,
          canvasSize.h - circle.y - circle.translateY - circle.size,
        ];
        const closest = Math.min(...edges);
        const edgeFade = Math.max(0, Math.min(1, closest / 18));
        circle.alpha += 0.02;
        if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha;
        circle.alpha *= edgeFade || 0.08;
        circle.x += circle.dx;
        circle.y += circle.dy;
        circle.translateX += (mouse.x / (48 / circle.magnetism) - circle.translateX) / 42;
        circle.translateY += (mouse.y / (48 / circle.magnetism) - circle.translateY) / 42;
        drawCircle(circle);

        if (
          circle.x < -circle.size ||
          circle.x > canvasSize.w + circle.size ||
          circle.y < -circle.size ||
          circle.y > canvasSize.h + circle.size
        ) {
          circles[i] = circleParams();
        }
      }
      raf = window.requestAnimationFrame(animate);
    }

    resize();
    animate();
    window.addEventListener('mousemove', onMouseMove);
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
    };
  }, [color, quantity, size]);

  return (
    <div ref={containerRef} className="clay-particles" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
