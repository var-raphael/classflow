'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { User, GraduationCap, BookOpen, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const SYMBOLS = [
  'Σ', '∫', '√', 'π', 'Δ', '∞', '≠', '≤', '≥', '∂', 'λ', 'θ', 'α', 'β', 'γ', 'φ', 'ω', 'μ',
  'f(x)', 'dx', 'dy', 'x²', 'y²', 'e^x', 'log', 'sin', 'cos', 'tan',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'ax+b', 'y=mx', 'E=mc²', 'a²+b²', 'n!', 'Σn', '∇f',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

const COLORS_DARK = [
  'rgba(129,140,248,0.65)',
  'rgba(167,139,250,0.60)',
  'rgba(52,211,153,0.55)',
  'rgba(96,165,250,0.55)',
  'rgba(249,168,212,0.50)',
  'rgba(252,211,77,0.50)',
  'rgba(255,255,255,0.35)',
];

const COLORS_LIGHT = [
  'rgba(99,102,241,0.30)',
  'rgba(139,92,246,0.28)',
  'rgba(16,185,129,0.25)',
  'rgba(59,130,246,0.28)',
  'rgba(236,72,153,0.22)',
  'rgba(245,158,11,0.25)',
  'rgba(100,116,139,0.20)',
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

export default function AuthPage() {
  const [userType, setUserType] = useState<'teacher' | 'student'>('student');
  const [isDark, setIsDark] = useState(false);
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const isDarkRef = useRef(isDark);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const createParticle = useCallback((canvas: HTMLCanvasElement, fromTop = false): Particle => {
    const colors = isDarkRef.current ? COLORS_DARK : COLORS_LIGHT;
    return {
      x: Math.random() * canvas.width,
      y: fromTop ? -30 : Math.random() * canvas.height,
      speed: 0.4 + Math.random() * 1.1,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
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

    const COUNT = Math.min(150, Math.floor((window.innerWidth * window.innerHeight) / 6000));
    particlesRef.current = Array.from({ length: COUNT }, () => createParticle(canvas));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const colors = isDarkRef.current ? COLORS_DARK : COLORS_LIGHT;

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

        if (p.y > canvas.height + 40) {
          const np = createParticle(canvas, true);
          np.color = colors[Math.floor(Math.random() * colors.length)];
          particlesRef.current[i] = np;
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle(userType);
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${
      isDark
        ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
        : 'bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100'
    }`}>
      {/* Falling canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      {/* Glow orbs */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: 500, height: 300, borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(99,102,241,0.10) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '20%',
          width: 350, height: 350, borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 z-10 p-2.5 rounded-xl transition-all ${
          isDark
            ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
            : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200 shadow-sm'
        }`}
        style={{ backdropFilter: 'blur(10px)' }}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Main content */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12" style={{ zIndex: 2 }}>
        <div className="w-full max-w-md">

          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 18, marginBottom: 16,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 30px rgba(99,102,241,0.4)',
            }}>
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-3xl font-bold mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ClassFlow
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Sign in to get started
            </p>
          </div>

          {/* Auth Card */}
          <div
            className={`rounded-2xl p-8 ${isDark ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-white/80 border border-slate-200 shadow-xl'}`}
            style={{ backdropFilter: 'blur(20px)' }}
          >
            {/* Role selector */}
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              I am a...
            </p>
            <div className={`flex gap-2 mb-6 p-1 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'}`}>
              <button
                onClick={() => setUserType('student')}
                disabled={isLoading}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  userType === 'student'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <User className="w-4 h-4" />
                Student
              </button>
              <button
                onClick={() => setUserType('teacher')}
                disabled={isLoading}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  userType === 'teacher'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <GraduationCap className="w-4 h-4" />
                Teacher
              </button>
            </div>

            {/* Role description */}
            <div className={`rounded-xl px-4 py-3 mb-6 text-xs ${
              isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-500'
            }`}>
              {userType === 'student'
                ? 'Access your assignments, submit work, and track your grades.'
                : 'Create assignments, manage your class, and grade submissions.'}
            </div>

            {/* Google Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all ${
                isDark
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-white text-slate-800 border-2 border-slate-200 hover:border-slate-300 hover:shadow-md'
              } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={{ boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.08)' }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-slate-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Footer note */}
            <p className={`text-center text-xs mt-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Your account is created automatically on first sign in
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
