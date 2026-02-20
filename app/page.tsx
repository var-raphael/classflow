'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, Award, ArrowRight, GraduationCap, BarChart3, MessageSquare } from 'lucide-react';

const SYMBOLS = [
  // Math
  'Σ', '∫', '√', 'π', 'Δ', '∞', '≠', '≤', '≥', '∂', 'λ', 'θ', 'α', 'β', 'γ', 'φ', 'ω', 'μ',
  'f(x)', 'dx', 'dy', 'x²', 'y²', 'e^x', 'log', 'sin', 'cos', 'tan',
  // Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Equations
  'ax+b', 'y=mx', 'E=mc²', 'a²+b²', 'n!', 'Σn', '∇f',
  // Letters
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

const COLORS = [
  'rgba(129,140,248,0.65)',  // indigo
  'rgba(167,139,250,0.60)',  // violet
  'rgba(52,211,153,0.55)',   // emerald
  'rgba(96,165,250,0.55)',   // blue
  'rgba(249,168,212,0.50)',  // pink
  'rgba(252,211,77,0.50)',   // amber
  'rgba(255,255,255,0.35)',  // white
];

interface Particle {
  x: number;
  y: number;
  speed: number;
  symbol: string;
  color: string;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  wobbleOffset: number;
}

export default function HomePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const createParticle = useCallback((canvas: HTMLCanvasElement, fromTop = false): Particle => {
    return {
      x: Math.random() * canvas.width,
      y: fromTop ? -30 : Math.random() * canvas.height,
      speed: 0.4 + Math.random() * 1.1,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 16 + Math.floor(Math.random() * 24),
      opacity: 0.55 + Math.random() * 0.40,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.015,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      wobbleOffset: 25 + Math.random() * 35,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init particles
    const COUNT = Math.min(150, Math.floor((window.innerWidth * window.innerHeight) / 6000));
    particlesRef.current = Array.from({ length: COUNT }, () => createParticle(canvas));

    const draw = () => {
      timeRef.current += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((p, i) => {
        p.y += p.speed;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotationSpeed;
        const xPos = p.x + Math.sin(p.wobble) * p.wobbleOffset;

        ctx.save();
        ctx.translate(xPos, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.font = `bold ${p.size}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.symbol, 0, 0);
        ctx.restore();

        // Reset when off screen
        if (p.y > canvas.height + 40) {
          particlesRef.current[i] = createParticle(canvas, true);
        }
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [createParticle]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1332 30%, #0a1628 60%, #071020 100%)' }}>
      {/* Animated canvas background */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, width: '100vw', height: '100vh' }} />

      {/* Radial glow effects */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '20%',
          width: '400px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '10%',
          width: '350px', height: '350px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
      </div>

      {/* Content */}
      <div className="relative flex flex-col min-h-screen" style={{ zIndex: 2 }}>

        {/* Nav */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-6">
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>
              <BookOpen size={20} color="white" />
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
              ClassFlow
            </span>
          </div>
          <button
            onClick={() => router.push('/auth')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              padding: '8px 20px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
              (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
              (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
            }}
          >
            Sign In
          </button>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 100, padding: '6px 16px',
            marginBottom: 32,
            backdropFilter: 'blur(10px)',
          }}>
            <GraduationCap size={14} color="#a5b4fc" />
            <span style={{ color: '#a5b4fc', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
              BUILT FOR MODERN CLASSROOMS
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(48px, 8vw, 88px)',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 24,
            maxWidth: 900,
          }}>
            Where Learning{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 50%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Flows
            </span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: 'rgba(255,255,255,0.6)',
            maxWidth: 520,
            lineHeight: 1.65,
            marginBottom: 48,
          }}>
            Streamline assignment management, track student progress, and deliver feedback. All in one elegant platform.
          </p>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => router.push('/auth')}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                border: 'none',
                padding: '16px 36px',
                borderRadius: 14,
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 0 40px rgba(99,102,241,0.5), 0 4px 20px rgba(0,0,0,0.4)',
                transition: 'all 0.2s',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px rgba(99,102,241,0.7), 0 8px 30px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(99,102,241,0.5), 0 4px 20px rgba(0,0,0,0.4)';
              }}
            >
              Get Started Free
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Social proof */}
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 24, fontWeight: 500 }}>
            No credit card required
          </p>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 48, marginTop: 64, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {[
              { val: '100%', label: 'Free to Use' },
              { val: 'Real-time', label: 'Grade Tracking' },
              { val: 'Instant', label: 'Feedback' },
            ].map(({ val, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em' }}>{val}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </main>

        {/* Features */}
        <section style={{ padding: '0 24px 100px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          {/* Divider */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
            marginBottom: 64,
          }} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {[
              {
                icon: Users,
                color: '#6366f1',
                glow: 'rgba(99,102,241,0.3)',
                title: 'For Teachers',
                desc: 'Create rich assignments with file attachments, manage your entire class roster, and grade submissions with detailed feedback.',
              },
              {
                icon: BookOpen,
                color: '#10b981',
                glow: 'rgba(16,185,129,0.3)',
                title: 'For Students',
                desc: 'View all your assignments in one place, submit work with file uploads, and track your grades and progress over time.',
              },
              {
                icon: BarChart3,
                color: '#8b5cf6',
                glow: 'rgba(139,92,246,0.3)',
                title: 'Analytics & Insights',
                desc: 'Visual grade trends, class rankings, and performance dashboards give everyone a clear picture of progress.',
              },
              {
                icon: MessageSquare,
                color: '#f59e0b',
                glow: 'rgba(245,158,11,0.3)',
                title: 'Live Collaboration',
                desc: 'Comment threads on every assignment enable real-time discussion and feedback between teachers and students.',
              },
            ].map(({ icon: Icon, color, glow, title, desc }) => (
              <div
                key={title}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20,
                  padding: '32px 28px',
                  backdropFilter: 'blur(20px)',
                  transition: 'all 0.3s',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${color}22`,
                  border: `1px solid ${color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                  boxShadow: `0 0 20px ${glow}`,
                }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 10, letterSpacing: '-0.02em' }}>
                  {title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 500 }}>
            © 2026 ClassFlow. Built for educators everywhere.
          </p>
        </footer>
      </div>
    </div>
  );
}
