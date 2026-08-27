import React from 'react';
import { Shield, Lock, FileText, UserCheck, Server, AlertCircle } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Privacy Policy</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Last updated: August 27, 2026 • Plain-language policy for College Times / AKGEC Times users.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        {/* Project Status */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <AlertCircle className="w-4 h-4" />
            <h2>Student Project Notice</h2>
          </div>
          <p>
            College Times (AKGEC Times) is an educational student project created for campus communication and community engagement. It is <strong>not a commercial service</strong>.
          </p>
        </section>

        {/* Data Collected */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <h2>Information We Collect</h2>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-slate-300">
            <li><strong>Account Identity:</strong> Phone number (via OTP authentication) or Email address (via Google Sign-In).</li>
            <li><strong>Profile Information:</strong> Display Name and optional Avatar photo URL.</li>
            <li><strong>User Content:</strong> Campus posts, Lost & Found notices, WhatsApp contact numbers provided on notices, comments, and event RSVPs.</li>
            <li><strong>Gamification Metrics:</strong> Activity points (+10 per post/notice, +2 per comment/RSVP) displayed on the campus leaderboard.</li>
          </ul>
        </section>

        {/* Purpose */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <FileText className="w-4 h-4 text-sky-400" />
            <h2>Why We Collect Data</h2>
          </div>
          <p>
            Data is collected solely to power campus social features: authenticating campus users, displaying post attribution, enabling Lost & Found WhatsApp contact, rendering event attendee lists, and preventing spam.
          </p>
        </section>

        {/* Infrastructure */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Server className="w-4 h-4 text-sky-400" />
            <h2>Storage & Cloud Infrastructure</h2>
          </div>
          <p>
            All user data and uploaded images are securely hosted on Google Cloud / Firebase infrastructure (asia-south1 region) protected by strict Firestore and Storage security rules.
          </p>
        </section>

        {/* Account Deletion */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Lock className="w-4 h-4 text-sky-400" />
            <h2>Data Retention & Deletion Requests</h2>
          </div>
          <p>
            You may request deletion of your account, posts, or personal data at any time by contacting campus administration or submitting a request via the in-app <strong>Report a Bug</strong> portal.
          </p>
        </section>
      </div>
    </div>
  );
};
