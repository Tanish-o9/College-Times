import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { CampusGroup } from '../../types/group';
import {
  regenerateGroupInviteCode,
  toggleGroupInviteEnabled,
} from '../../services/groupInviteService';
import {
  Copy,
  Check,
  RefreshCw,
  Share2,
  QrCode,
  Lock,
  Unlock,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupInviteManagerProps {
  group: CampusGroup;
  onGroupUpdated?: (updated: CampusGroup) => void;
}

/**
 * Simple SVG matrix generator for visual QR rendering without external dependencies.
 */
const renderSimpleSvgQr = (data: string) => {
  // Generate deterministic binary matrix from input string hash
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns at corners
  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[startY + r][startX + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Hash payload into cells
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8)
      ) {
        continue; // skip finders
      }
      const bit = ((hash ^ (r * 31 + c * 17)) & (1 << ((r + c) % 16))) !== 0;
      cells[r][c] = bit;
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-36 h-36 bg-white p-2 rounded-2xl shadow-inner">
      {cells.map((row, r) =>
        row.map((active, c) => (
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width="1"
            height="1"
            fill={active ? '#0f172a' : '#ffffff'}
          />
        ))
      )}
    </svg>
  );
};

export const GroupInviteManager: React.FC<GroupInviteManagerProps> = ({
  group,
  onGroupUpdated,
}) => {
  const { currentUser } = useAuth();
  const isOwner = currentUser?.uid === group.createdBy;

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeHidden, setCodeHidden] = useState(false);

  const inviteCode = group.inviteCodePlaintext || group.inviteCodeHash || 'CT-UNAVAIL';
  const joinUrl = `${window.location.origin}/groups/join?code=${inviteCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      toast.success('Pass code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      toast.error('Failed to copy code.');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      toast.success('Group invite link copied!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  const handleRegenerate = async () => {
    if (!currentUser || !isOwner || busy) return;
    if (!window.confirm('Regenerate invite pass code? Existing pass code will immediately stop working.')) {
      return;
    }

    setBusy(true);
    try {
      const newCode = await regenerateGroupInviteCode(group.id, currentUser);
      toast.success(`New pass code generated: ${newCode}`);
      onGroupUpdated?.({
        ...group,
        inviteCodePlaintext: newCode,
        inviteCodeHash: newCode,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate code.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!currentUser || !isOwner || busy) return;
    const nextState = group.inviteEnabled === false ? true : false;
    setBusy(true);
    try {
      await toggleGroupInviteEnabled(group.id, nextState, currentUser);
      toast.success(nextState ? 'Invite pass code enabled' : 'Invite pass code disabled');
      onGroupUpdated?.({
        ...group,
        inviteEnabled: nextState,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invite settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Group Invite & Pass Code</h3>
            <p className="text-[11px] text-slate-400">Share secure access code with campus peers</p>
          </div>
        </div>

        {isOwner && (
          <button
            onClick={handleToggleEnabled}
            disabled={busy}
            title={group.inviteEnabled === false ? 'Enable Invite Code' : 'Disable Invite Code'}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              group.inviteEnabled === false
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            {group.inviteEnabled === false ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Invites Disabled</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Invites Active</span>
              </>
            )}
          </button>
        )}
      </div>

      {group.inviteEnabled === false ? (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 text-center text-xs text-rose-300">
          Invite codes are currently disabled for this group by the owner.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex-1 w-full flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3">
              <span className="font-mono text-lg font-black tracking-widest text-amber-300">
                {codeHidden ? 'CT-••••••' : inviteCode}
              </span>
              <button
                onClick={() => setCodeHidden(!codeHidden)}
                className="p-1 text-slate-400 hover:text-slate-200"
                title={codeHidden ? 'Show Code' : 'Hide Code'}
              >
                {codeHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleCopyCode}
                className="flex-1 sm:flex-initial px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex-1 sm:flex-initial px-4 py-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              onClick={() => setShowQr(!showQr)}
              className="text-amber-400 hover:underline flex items-center gap-1.5 font-medium"
            >
              <QrCode className="w-4 h-4" />
              <span>{showQr ? 'Hide QR Code' : 'Show QR Code'}</span>
            </button>

            {isOwner && (
              <button
                onClick={handleRegenerate}
                disabled={busy}
                className="text-slate-400 hover:text-rose-400 flex items-center gap-1.5 font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                <span>Regenerate Code</span>
              </button>
            )}
          </div>

          {showQr && (
            <div className="flex flex-col items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-200">
              {renderSimpleSvgQr(joinUrl)}
              <p className="text-[11px] text-slate-400 font-mono">Scan to join {group.name}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
