import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/store/notificationStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/api/client';
import type { Notification } from '@/types';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { notifications, unreadCount, setNotifications, addNotification, markRead } =
    useNotificationStore();

  // Load notifications
  useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get<Notification[]>('/admin/notifications');
      setNotifications(data);
      return data;
    },
    enabled: !!user,
  });

  // WS for real-time
  useWebSocket(`/user/${user?.id ?? 'noop'}`, {
    'notification:broadcast': (payload) => {
      addNotification({
        id: crypto.randomUUID(),
        user_id: user?.id ?? '',
        type: 'broadcast',
        title: payload.title as string,
        message: payload.message as string,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    },
    'notification:new': (payload) => {
      addNotification(payload as unknown as Notification);
    },
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/notifications/${id}/read`),
    onSuccess: (_d, id) => markRead(id),
  });

  return (
    <div className={styles.root} ref={panelRef}>
      <button
        className={styles.bell}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Notifications</span>
            {unreadCount > 0 && <span className={styles.unreadLabel}>{unreadCount} new</span>}
          </div>
          <ul className={styles.list}>
            {notifications.length === 0 && (
              <li className={styles.empty}>No notifications yet</li>
            )}
            {notifications.map((n) => (
              <li
                key={n.id}
                className={n.is_read ? styles.item : `${styles.item} ${styles.itemUnread}`}
                onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
              >
                <span className={styles.itemTitle}>{n.title}</span>
                <span className={styles.itemMessage}>{n.message}</span>
                <span className={styles.itemTime}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
