import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../types/notification';
import { formatTimestamp } from '../utils/format';
import { markNotificationAsRead } from '../services/notificationService';
import { Bell, Heart, Check, AtSign, CornerDownRight } from 'lucide-react';
import { logAnalyticsEvent } from '../lib/firebase';

interface NotificationCardProps {
  notification: NotificationItem | any;
  onSelect?: (notification: NotificationItem | any) => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onSelect,
}) => {
  const navigate = useNavigate();

  const handleClick = async () => {
    if (!notification.read && notification.id) {
      await markNotificationAsRead(notification.id);
    }

    if (notification.channelId) {
      logAnalyticsEvent('chat_notification_opened', { 
        channelId: notification.channelId,
        messageId: notification.messageId || 'unknown',
        type: notification.type || 'chat'
      });
      const targetUrl = notification.messageId
        ? `/chat/${notification.channelId}?msgId=${notification.messageId}`
        : `/chat/${notification.channelId}`;
      navigate(targetUrl);
    }

    if (onSelect) {
      onSelect(notification);
    }
  };

  const isReply = notification.type === 'reply' || notification.message.includes('replied');
  const isReaction = notification.type === 'reaction' || notification.message.includes('reacted');
  const isMention = notification.type === 'mention' || notification.message.includes('mentioned you') || (!isReply && !isReaction && !!notification.channelId);
  const isLike = notification.message.includes('liked');

  return (
    <div
      onClick={handleClick}
      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
        !notification.read
          ? 'bg-sky-500/10 border-sky-500/30 text-white shadow-md'
          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
      }`}
    >
      {/* Icon Badge */}
      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
        isMention
          ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
          : isReply
          ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400'
          : isReaction || isLike
          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
          : 'bg-slate-800 border border-slate-700 text-slate-300'
      }`}>
        {isMention ? (
          <AtSign className="w-4 h-4 text-purple-400" />
        ) : isReply ? (
          <CornerDownRight className="w-4 h-4 text-sky-400" />
        ) : isReaction || isLike ? (
          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug ${!notification.read ? 'font-semibold text-white' : 'font-normal text-slate-300'}`}>
          {notification.message}
        </p>
        <span className="text-[10px] text-slate-500 font-mono mt-1 block">
          {formatTimestamp(notification.timestamp || notification.createdAt)}
        </span>
      </div>

      {/* Unread Dot / Read Checkmark */}
      {!notification.read ? (
        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 mt-2 animate-pulse" />
      ) : (
        <Check className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-1" />
      )}
    </div>
  );
};
