import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/store/notificationStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/api/client';
import type { Notification } from '@/types';
import styles from './NotificationBell.module.css';

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

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
        <BellIcon />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>// notifications</span>
            {unreadCount > 0 && <span className={styles.unreadLabel}>[{unreadCount}] new</span>}
          </div>
          <ul className={styles.list}>
            {notifications.length === 0 && (
              <li className={styles.empty}>// no notifications yet</li>
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
