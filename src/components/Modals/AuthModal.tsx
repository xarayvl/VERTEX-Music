import React, { useState } from 'react';
import { X, LogIn, UserPlus, Music2, AlertCircle, Lock, Mail, User } from 'lucide-react';
import { UserProfile } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile, token?: string) => void;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  canClose = true,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register State
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: loginIdentifier,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          displayName: regDisplayName,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white">
        
        {/* Header Graphic */}
        <div className="relative p-6 bg-gradient-to-r from-[#A855F7] via-[#D946EF] to-purple-600 flex flex-col items-center justify-center text-center">
          {canClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-3 shadow-lg border border-white/20">
            <Music2 className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white">VERTEX Music</h2>
          <p className="text-xs text-white/90 font-medium mt-1">
            {mode === 'login' ? 'Sign in to access your library & playlists' : 'Create your VERTEX account to start saving music'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-[#121212]">
          <button
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-extrabold flex items-center justify-center space-x-2 transition-colors border-b-2 ${
              mode === 'login'
                ? 'border-[#D946EF] text-[#D946EF] bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-extrabold flex items-center justify-center space-x-2 transition-colors border-b-2 ${
              mode === 'register'
                ? 'border-[#D946EF] text-[#D946EF] bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Register</span>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full pl-9 pr-4 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-4 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-sm shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full pl-9 pr-4 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="yourname@example.com"
                    className="w-full pl-9 pr-4 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="Your public profile name"
                  className="w-full px-4 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full pl-9 pr-4 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-sm shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
