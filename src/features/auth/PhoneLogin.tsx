import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConfirmationResult } from 'firebase/auth';
import { sendOtp, verifyOtp, signInWithGoogle, clearRecaptcha } from '../../services/authService';
import { EmailOtpLogin } from './EmailOtpLogin';
import toast from 'react-hot-toast';
import { Phone, ShieldCheck, ArrowRight, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';

export const PhoneLogin: React.FC = () => {
  const navigate = useNavigate();

  // Mode selection: 'phone' | 'email'
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('email');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  // Resend OTP Countdown (30 seconds)
  const [countdown, setCountdown] = useState<number>(0);

  // Clean up reCAPTCHA verifier on unmount
  useEffect(() => {
    return () => {
      clearRecaptcha();
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle phone input change (digits only, max 10)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(digits);
  };

  // Handle OTP input change (digits only, max 6)
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(digits);
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      // Error handled in authService toast
    } finally {
      setGoogleLoading(false);
    }
  };

  // Step 1: Submit Phone Number to Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const indianPhoneRegex = /^[6-9]\d{9}$/;
    if (!indianPhoneRegex.test(phoneNumber)) {
      toast.error('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.', { id: 'phone-regex' });
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtp(phoneNumber);
      setConfirmationResult(result);
      setStep(2);
      setCountdown(30); // Enable 30-second countdown for resend
    } catch (err) {
      // Error handles toast in authService
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;

    setLoading(true);
    try {
      const result = await sendOtp(phoneNumber);
      setConfirmationResult(result);
      setCountdown(30);
    } catch (err) {
      // Error handles toast in authService
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || otpCode.length !== 6) return;

    setLoading(true);
    try {
      await verifyOtp(confirmationResult, otpCode);
      // On success, redirect to feed placeholder
      navigate('/');
    } catch (err) {
      // Error handles toast in authService
    } finally {
      setLoading(false);
    }
  };

  if (authMode === 'email') {
    return (
      <EmailOtpLogin
        onSuccess={() => navigate('/')}
        onSwitchToPhone={() => setAuthMode('phone')}
      />
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Hidden invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-3">
            {step === 1 ? <Phone className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-bold text-white">
            {step === 1 ? 'Student Authentication' : 'Verify OTP Code'}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {step === 1
              ? 'Login with your 10-digit mobile number or Google account'
              : `Enter the 6-digit code sent to +91 ${phoneNumber}`}
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-6">
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="phone-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Mobile Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-bold text-sky-400 select-none">
                    +91
                  </span>
                  <input
                    id="phone-input"
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                    className="w-full pl-14 pr-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-xl text-white text-base font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-slate-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Protected by Firebase Invisible reCAPTCHA
                </p>
              </div>

              <button
                type="submit"
                disabled={phoneNumber.length !== 10 || loading || googleLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900/90 px-3 text-slate-400 font-medium">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-all duration-200 shadow-md"
            >
              {googleLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                6-Digit Verification Code
              </label>
              <input
                id="otp-input"
                type="text"
                value={otpCode}
                onChange={handleOtpChange}
                placeholder="123456"
                maxLength={6}
                autoFocus
                required
                className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-xl text-white text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-slate-700 placeholder:tracking-normal"
              />
            </div>

            <button
              type="submit"
              disabled={otpCode.length !== 6 || loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all duration-200"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify OTP</span>
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                Change Number
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || loading}
                className="text-sky-400 hover:text-sky-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
