import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Library,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import { UserProfile } from '../../types';
import VertexLogo from '../Brand/VertexLogo';
import LogoLoop from '../LogoLoop/LogoLoop';

const AUTH_TERMINAL_GRID = [2, 1];
const FaultyTerminal = React.lazy(() => import('../Backgrounds/FaultyTerminal'));

const AUTH_LOOP_ITEMS = [
  {
    node: <span className="flex items-center gap-2 font-black tracking-tight"><VertexLogo alt="" className="h-[1.25em] w-[1.25em] shrink-0" /> VERTEX Music</span>,
    title: 'VERTEX Music',
  },
  {
    node: <span className="flex items-center gap-2 font-bold"><img src="/selim-chat-logo.png" alt="" className="h-[1.7em] w-[1.7em] shrink-0 rounded-full object-cover" draggable={false} /> Selim Chat</span>,
    title: 'Selim Chat',
  },
  {
    node: <span className="flex items-center gap-2 font-bold"><svg viewBox="0 0 24 24" className="h-[1.15em] w-[1.15em] shrink-0 text-white" aria-hidden="true"><path fill="currentColor" d="M12 0c0 6.627-5.373 12-12 12 6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12C17.373 12 12 6.627 12 0Z" /></svg> Google Gemini</span>,
    title: 'Google Gemini',
  },
];

// Public OAuth client id — safe to expose in frontend code, Google's Sign-In
// flow relies on the ID token being verified server-side, not on this value
// being secret.
const GOOGLE_CLIENT_ID = '266806941595-ecv3f1f5pah0nrni31e9a4huevruv8i6.apps.googleusercontent.com';

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 13.9A6.02 6.02 0 0 1 6.09 12c0-.66.11-1.3.31-1.9V7.51H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.49L6.4 13.9Z" />
    <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.51L6.4 10.1C7.19 7.73 9.4 5.97 12 5.97Z" />
  </svg>
);

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt?: () => void;
          cancel?: () => void;
        };
      };
    };
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile, token?: string) => void;
}

type UsernameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';
type GoogleButtonStatus = 'loading' | 'ready' | 'error';
type AuthSuccessKind = 'login' | 'register' | 'google';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameAvailabilityStatus>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [googleStatus, setGoogleStatus] = useState<GoogleButtonStatus>('loading');
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleRetryKey, setGoogleRetryKey] = useState(0);
  const [authSuccess, setAuthSuccess] = useState<AuthSuccessKind | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const authSuccessTimerRef = useRef<number | null>(null);

  const completeAuthentication = (
    user: UserProfile,
    token: string | undefined,
    successKind: AuthSuccessKind
  ) => {
    setLoading(false);
    setError(null);
    setGoogleError(null);
    setAuthSuccess(successKind);

    if (authSuccessTimerRef.current !== null) {
      window.clearTimeout(authSuccessTimerRef.current);
    }
    authSuccessTimerRef.current = window.setTimeout(() => {
      onLoginSuccess(user, token);
      onClose();
      setAuthSuccess(null);
      authSuccessTimerRef.current = null;
    }, 1100);
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    if (loading) return;
    setMode(nextMode);
    setShowPassword(false);
    setError(null);
    setGoogleError(null);
  };

  const handleGoogleCredential = async (credential: string) => {
    setError(null);
    setGoogleError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setGoogleError(data.error || 'Google sign-in failed. Please try again.');
        return;
      }
      completeAuthentication(data.user, data.token, 'google');
    } catch {
      setGoogleError('Google sign-in could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let attempts = 0;
    let retryTimer: number | null = null;
    setGoogleStatus('loading');
    setGoogleError(null);

    const tryRender = () => {
      if (cancelled) return;
      const google = window.google;
      if (!google || !googleButtonRef.current) {
        attempts += 1;
        if (attempts < 50) {
          retryTimer = window.setTimeout(tryRender, 100);
        } else {
          setGoogleStatus('error');
          setGoogleError('Google sign-in could not be loaded. Check your connection and try again.');
        }
        return;
      }
      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) void handleGoogleCredential(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleButtonRef.current.innerHTML = '';
        const buttonWidth = Math.max(240, Math.floor(googleButtonRef.current.clientWidth));
        google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          width: buttonWidth,
          logo_alignment: 'center',
        });
        setGoogleStatus('ready');
      } catch {
        setGoogleStatus('error');
        setGoogleError('Google sign-in could not be initialized. Please try again.');
      }
    };

    tryRender();
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [isOpen, mode, googleRetryKey]);

  useEffect(() => {
    if (!isOpen || mode !== 'register') {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }

    const cleanUsername = regUsername.trim();
    if (!cleanUsername) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      setUsernameStatus('invalid');
      setUsernameMessage(
        cleanUsername.length < 3
          ? 'Use at least 3 characters.'
          : 'Only letters, numbers, dot, underscore and hyphen are allowed.'
      );
      return;
    }

    const controller = new AbortController();
    setUsernameStatus('checking');
    setUsernameMessage('Checking availability...');

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/auth/username-availability?username=${encodeURIComponent(cleanUsername)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) {
          setUsernameStatus('error');
          setUsernameMessage(data.error || 'Availability check failed. Registration can still be attempted.');
          return;
        }
        if (data.available) {
          setUsernameStatus('available');
          setUsernameMessage('Username is available.');
        } else {
          setUsernameStatus('taken');
          setUsernameMessage('This username is already taken.');
        }
      } catch (requestError) {
        if ((requestError as Error).name === 'AbortError') return;
        setUsernameStatus('error');
        setUsernameMessage('Could not check availability. Registration can still be attempted.');
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, mode, regUsername]);

  useEffect(() => () => {
    if (authSuccessTimerRef.current !== null) {
      window.clearTimeout(authSuccessTimerRef.current);
    }
  }, []);

  if (!isOpen) return null;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: loginIdentifier, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Login failed. Please check your credentials.');
        return;
      }
      completeAuthentication(data.user, data.token, 'login');
    } catch {
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (usernameStatus === 'checking') {
      setError('Please wait for the username availability check to finish.');
      return;
    }
    if (usernameStatus === 'invalid' || usernameStatus === 'taken') {
      setError(usernameMessage || 'Please choose another username.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          displayName: regDisplayName,
          password: regPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Registration failed.');
        return;
      }
      completeAuthentication(data.user, data.token, 'register');
    } catch {
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10';
  const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400';

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-y-auto bg-black p-2 text-white animate-in fade-in duration-200 sm:p-5">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <React.Suspense fallback={<div className="h-full w-full bg-[#050307]" />}>
          <FaultyTerminal
            scale={1.35}
            gridMul={AUTH_TERMINAL_GRID}
            digitSize={1.25}
            timeScale={0.45}
            pause={false}
            scanlineIntensity={0.55}
            glitchAmount={0.75}
            flickerAmount={0.65}
            noiseAmp={0.45}
            chromaticAberration={0.55}
            dither={0.25}
            curvature={0.12}
            tint="#c084fc"
            mouseReact={true}
            mouseStrength={0.3}
            pageLoadAnimation={true}
            brightness={1}
          />
        </React.Suspense>
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(168,85,247,0.06),transparent_42%),linear-gradient(to_bottom,rgba(0,0,0,0.18),rgba(0,0,0,0.5))]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center justify-center">
        <section className="relative grid w-full overflow-hidden rounded-[2rem] border border-white/[0.14] bg-[#111012]/60 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-[4px] animate-in zoom-in-95 duration-300 md:grid-cols-[0.92fr_1.08fr]">
          {authSuccess && (
            <div
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6 text-center animate-in fade-in duration-300"
              role="status"
              aria-live="assertive"
            >
              <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151316] px-7 py-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">Authentication successful</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  {authSuccess === 'register'
                    ? 'Your account is ready!'
                    : authSuccess === 'google'
                      ? 'Google sign-in complete!'
                      : 'Welcome back!'}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">Taking you to your music space...</p>
              </div>
            </div>
          )}

          <aside className="relative hidden min-h-[640px] overflow-hidden border-r border-white/10 bg-gradient-to-br from-[#2b1738]/[0.10] via-[#17111d]/10 to-[#0d0d0f]/[0.10] p-9 backdrop-blur-md md:flex md:flex-col md:justify-between">
            <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#A855F7]/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#D946EF]/15 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative">
              <div className="flex items-center gap-3">
                <VertexLogo alt="" className="h-12 w-12 shrink-0" />
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D8B4FE]">Your sound. Your space.</p><h1 className="mt-0.5 text-xl font-black tracking-tight">VERTEX Music</h1></div>
              </div>

              <div className="mt-14">
                <h2 className="max-w-sm text-[2rem] font-black leading-[1.12] tracking-[-0.03em]">Everything you listen to, create and share in one place.</h2>
                <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-300">Return to your library or create an account to publish music, build playlists and keep listening history synced.</p>
              </div>
            </div>

            <div className="relative grid gap-2.5">
              {[
                { icon: Headphones, text: 'Continue your listening history' },
                { icon: Library, text: 'Keep releases and playlists together' },
                { icon: ShieldCheck, text: 'Secure account-backed ownership' },
              ].map(({ icon: Icon, text }, index) => (
                <div key={text} style={{ '--stagger-index': index } as React.CSSProperties} className="stagger-item flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-zinc-200">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#A855F7]/12 text-[#E9D5FF]"><Icon className="h-4 w-4" /></span>{text}
                </div>
              ))}
            </div>
          </aside>

          <main className="relative flex min-h-[560px] flex-col justify-center bg-[#09070b]/55 p-5 backdrop-blur-md sm:p-8 md:min-h-[640px] md:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7 flex items-center gap-3 md:hidden">
                <VertexLogo alt="" className="h-11 w-11 shrink-0" />
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#D8B4FE]">Welcome to</p><p className="mt-0.5 text-lg font-black">VERTEX Music</p></div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.08] bg-black/25 p-1.5">
                <button type="button" onClick={() => switchMode('login')} className={`control-press flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all ${mode === 'login' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}><LogIn className="h-4 w-4" /> Sign in</button>
                <button type="button" onClick={() => switchMode('register')} className={`control-press flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all ${mode === 'register' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}><UserPlus className="h-4 w-4" /> Sign up</button>
              </div>

              <div key={mode} className="mt-7 animate-in fade-in slide-in-from-right-2 duration-300">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D8B4FE]">{mode === 'login' ? 'Welcome back' : 'New listener'}</p>
                <h2 className="mt-1.5 text-[1.75rem] font-black leading-tight tracking-[-0.025em]">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</h2>
                <p className="mt-2 text-sm leading-5 text-zinc-400">{mode === 'login' ? 'Your library, playlists and artist tools are waiting.' : 'Set up your profile and start building your music space.'}</p>
              </div>

              {error && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3.5 text-[13px] font-semibold text-red-200 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col items-center gap-3">
                <div className={`relative w-full ${loading ? 'pointer-events-none opacity-50' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (googleStatus === 'error') setGoogleRetryKey((key) => key + 1);
                    }}
                    disabled={loading || googleStatus === 'loading'}
                    tabIndex={googleStatus === 'ready' ? -1 : undefined}
                    aria-hidden={googleStatus === 'ready'}
                    className={`control-press flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black transition-all ${
                      googleStatus === 'error'
                        ? 'border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15'
                        : 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] shadow-[0_14px_36px_rgba(168,85,247,0.25)]'
                    } ${googleStatus === 'ready' ? 'pointer-events-none' : ''} disabled:cursor-wait`}
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Please wait...
                      </>
                    ) : googleStatus === 'loading' ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Loading Google sign-in...
                      </>
                    ) : googleStatus === 'error' ? (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        Retry Google sign-in
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
                          <GoogleMark />
                        </span>
                        {mode === 'register' ? 'Sign up with Google' : 'Sign in with Google'}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <div
                    ref={googleButtonRef}
                    className={`absolute inset-0 z-10 flex h-full w-full cursor-pointer overflow-hidden opacity-0 [&>div]:!h-full [&>div]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full ${
                      googleStatus === 'ready' && !loading ? '' : 'pointer-events-none'
                    }`}
                  />
                </div>
                {googleError && (
                  <div className="flex w-full items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.08] px-3 py-2.5 text-xs font-semibold leading-4 text-red-200 animate-in fade-in slide-in-from-top-1" role="alert">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{googleError}</span>
                  </div>
                )}
                <div className="flex w-full items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  <span className="h-px flex-1 bg-white/10" /> Or <span className="h-px flex-1 bg-white/10" />
                </div>
              </div>

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <div><label className={labelClass}>Username or email</label><div className="relative"><User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input type="text" autoComplete="username" required value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} placeholder="Enter username or email" className={inputClass} /></div></div>
                  <div><label className={labelClass}>Password</label><div className="relative"><Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Enter your password" className={`${inputClass} pr-12`} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                  <button type="submit" disabled={loading} className="control-press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3.5 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.25)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Signing in...</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}</button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="mt-6 space-y-3.5">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Username</label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          autoComplete="username"
                          required
                          minLength={3}
                          maxLength={32}
                          value={regUsername}
                          onChange={(event) => setRegUsername(event.target.value)}
                          placeholder="username"
                          aria-describedby="username-availability"
                          className={`${inputClass} pr-10`}
                        />
                        {usernameStatus === 'checking' && (
                          <span className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-500 border-t-[#C084FC]" />
                        )}
                        {usernameStatus === 'available' && (
                          <CheckCircle2 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                        )}
                        {(usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'error') && (
                          <AlertCircle className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 ${usernameStatus === 'error' ? 'text-amber-400' : 'text-red-400'}`} />
                        )}
                      </div>
                      <p
                        id="username-availability"
                        aria-live="polite"
                        className={`mt-1.5 min-h-4 px-1 text-[11px] font-semibold leading-4 ${
                          usernameStatus === 'available'
                            ? 'text-emerald-400'
                            : usernameStatus === 'error'
                              ? 'text-amber-300'
                              : usernameStatus === 'taken' || usernameStatus === 'invalid'
                                ? 'text-red-300'
                                : 'text-zinc-500'
                        }`}
                      >
                        {usernameMessage}
                      </p>
                    </div>
                    <div><label className={labelClass}>Display name</label><div className="relative"><Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input type="text" autoComplete="name" maxLength={80} value={regDisplayName} onChange={(event) => setRegDisplayName(event.target.value)} placeholder="Public name" className={inputClass} /></div></div>
                  </div>
                  <div><label className={labelClass}>Email address</label><div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input type="email" autoComplete="email" required value={regEmail} onChange={(event) => setRegEmail(event.target.value)} placeholder="yourname@example.com" className={inputClass} /></div></div>
                  <div><label className={labelClass}>Password</label><div className="relative"><Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={regPassword} onChange={(event) => setRegPassword(event.target.value)} placeholder="At least 8 characters" className={`${inputClass} pr-12`} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                  <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-zinc-400"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Your library remains tied to this account.</div>
                  <button type="submit" disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid'} className="control-press flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3.5 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.25)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Creating account...</> : <>Create account <ArrowRight className="h-4 w-4" /></>}</button>
                </form>
              )}

              <p className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-5 text-zinc-500">By continuing, you confirm that this account belongs to you and that uploaded music follows the platform rules.</p>
            </div>
          </main>
        </section>
      </div>

      <div className="relative z-10 -mx-2 -mb-2 mt-3 w-[calc(100%+1rem)] shrink-0 overflow-hidden px-2 pb-4 pt-3 sm:-mx-5 sm:-mb-5 sm:w-[calc(100%+2.5rem)] sm:px-5 sm:pb-6">
        <LogoLoop
          logos={AUTH_LOOP_ITEMS}
          speed={64}
          direction="left"
          logoHeight={14}
          gap={42}
          hoverSpeed={0}
          scaleOnHover
          ariaLabel="VERTEX Music highlights"
          className="text-zinc-400"
        />
      </div>
    </div>
  );
};
