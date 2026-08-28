import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import imageCompression from 'browser-image-compression';
import { 
  signUpWithEmailPassword, 
  signInWithEmailPassword, 
  signInWithGoogle 
} from '../../services/authService';
import { PhoneLogin } from './PhoneLogin';
import { 
  Mail, 
  Lock, 
  User, 
  AtSign, 
  GraduationCap, 
  Calendar, 
  FileText, 
  Image as ImageIcon,
  LogIn, 
  UserPlus, 
  Sparkles, 
  RefreshCw,
  Phone,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEPARTMENTS = [
  { id: 'cse', name: 'Computer Science & Engineering' },
  { id: 'ece', name: 'Electronics & Communication' },
  { id: 'it', name: 'Information Technology' },
  { id: 'aiml', name: 'AI & Machine Learning' },
  { id: 'me', name: 'Mechanical Engineering' },
  { id: 'ce', name: 'Civil Engineering' },
];

const BATCHES = [2026, 2027, 2028, 2029, 2030];

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=John',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Sophia',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Liam',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia',
];

export const LoginPage: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'phone_otp'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Signup OTP verification states
  const [showSignupOtp, setShowSignupOtp] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState('cse');
  const [batchYear, setBatchYear] = useState('2028');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState(DEFAULT_AVATARS[0]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const options = {
        maxSizeMB: 0.03, // Compress to ~30KB max
        maxWidthOrHeight: 180, // Avatar dimensions
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setPhotoURL(base64data);
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error('Failed to compress/read image:', err);
      toast.error('Failed to upload image. Please try a different file.');
      setUploadingAvatar(false);
    }
  };

  if (!loading && currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password) {
      toast.error('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailPassword(email.trim(), password);
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || sendingOtp) return;

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedEmail || !password || !trimmedName || !trimmedUsername) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    const usernameRegex = /^[a-z0-9_]{3,30}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      toast.error('Username must be 3-30 characters long and contain only lowercase letters, numbers, and underscores.');
      return;
    }

    setSendingOtp(true);
    try {
      const { requestEmailOtp } = await import('../../services/authService');
      await requestEmailOtp(trimmedEmail);
      setShowSignupOtp(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedOtp = signupOtp.trim();
    if (trimmedOtp.length !== 6) {
      toast.error('Please enter the 6-digit OTP code.');
      return;
    }

    setSubmitting(true);
    try {
      const { verifyOtpOnly } = await import('../../services/authService');
      const verified = await verifyOtpOnly(email.trim(), trimmedOtp);
      if (verified) {
        await signUpWithEmailPassword(
          email.trim(),
          password,
          displayName.trim(),
          username.trim().toLowerCase(),
          department,
          Number(batchYear),
          bio.trim(),
          photoURL
        );
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err.message || 'Incorrect verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      // Handled in service
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8 px-4 sm:px-6 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -z-10 animate-pulse duration-4000" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse duration-6000" />

      {activeTab === 'phone_otp' ? (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <PhoneLogin />
          <div className="text-center pt-2">
            <button
              onClick={() => setActiveTab('login')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              Back to Email & Password Login
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          {/* Top Branding Section */}
          <div className="p-6 text-center border-b border-slate-800 bg-slate-950/40 shrink-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full text-xs font-semibold text-sky-400 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Welcome to College Times</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Campus Social Networks
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Connect with department mates, batch clubs, and direct messaging.
            </p>
          </div>

          {/* Switch Tab Headers */}
          <div className="flex border-b border-slate-800 p-1.5 bg-slate-950/20 shrink-0">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all ${
                activeTab === 'login'
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>

            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all ${
                activeTab === 'signup'
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-6 overflow-y-auto max-h-[60vh] flex-1">
            {showSignupOtp ? (
              <form onSubmit={handleVerifySignupOtp} className="space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Verify Your Email Address</h3>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                    We've sent a 6-digit verification code to <span className="text-purple-400 font-bold font-mono">{email}</span>. Please enter it below.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    value={signupOtp}
                    onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-center text-2xl font-mono tracking-[0.5em] text-purple-300 placeholder-slate-800 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || signupOtp.length !== 6}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all text-xs"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Verify & Create Account</span>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignupOtp(false);
                      setSignupOtp('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Change Registration Details
                  </button>
                </div>
              </form>
            ) : activeTab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    College Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. tanish@college.edu"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all text-xs"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Tanish"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Choose Username *
                    </label>
                    <div className="relative">
                      <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                        placeholder="e.g. tanish_29 (3-30 chars)"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    College Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. tanish@college.edu"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Create Password * (Min 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters..."
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Department
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white focus:outline-none"
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Graduation Year
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <select
                        value={batchYear}
                        onChange={(e) => setBatchYear(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white focus:outline-none"
                      >
                        {BATCHES.map((year) => (
                          <option key={year} value={year}>
                            Batch {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Display Picture (DP) Select */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Choose Profile Avatar (DP)
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                    {DEFAULT_AVATARS.map((avatar) => (
                      <button
                        type="button"
                        key={avatar}
                        onClick={() => setPhotoURL(avatar)}
                        className={`aspect-square rounded-2xl overflow-hidden border bg-slate-950 transition-all ${
                          photoURL === avatar
                            ? 'border-purple-500 scale-105 shadow-lg shadow-purple-500/20'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <img src={avatar} alt="Avatar option" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={photoURL.startsWith('data:image/') ? '[Custom Uploaded Photo]' : photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        placeholder="Or enter custom image URL link..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-850 hover:border-purple-500 rounded-xl cursor-pointer text-xs text-slate-300 transition-all">
                        <Upload className="w-3.5 h-3.5 text-purple-400" />
                        <span>Upload Custom Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadingAvatar && <span className="text-[10px] text-slate-500 animate-pulse">Compressing photo...</span>}
                      {photoURL.startsWith('data:image/') && (
                        <span className="text-[10px] text-purple-400 flex items-center gap-1 font-semibold">✓ Uploaded DP</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Short Bio / Status (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 160))}
                      placeholder="Tell campus who you are..."
                      rows={2}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all text-xs"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Create Account & Join Campus</span>
                  )}
                </button>
              </form>
            )}

            {/* Social Divider */}
            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-slate-900 px-3 text-slate-500 font-semibold">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting || googleLoading}
                className="py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all text-xs"
              >
                {googleLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.6-1.5-.9-3.2-.9-5z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.1C3.7 19.8 7.5 23 12 23z"
                    />
                  </svg>
                )}
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('phone_otp')}
                disabled={submitting || googleLoading}
                className="py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all text-xs"
              >
                <Phone className="w-4 h-4 text-sky-400" />
                <span>Mobile OTP</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
