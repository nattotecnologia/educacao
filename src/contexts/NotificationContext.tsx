'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

interface NotificationStateProps {
  notifications: Notification[];
  unreadCount: number;
}

interface NotificationDispatchProps {
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationStateContext = createContext<NotificationStateProps | undefined>(undefined);
const NotificationDispatchContext = createContext<NotificationDispatchProps | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);

  const addToast = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('@eduflow:notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) })));
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('@eduflow:notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    setNotifications((prev) => [
      {
        ...notification,
        id: crypto.randomUUID(),
        read: false,
        createdAt: new Date(),
      },
      ...prev,
    ]);
    addToast(notification.title, notification.message, notification.type);
  }, [addToast]);

  // Realtime — apenas 4 eventos relevantes
  useEffect(() => {
    const supabase = createClient();

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('institution_id')
        .eq('id', user.id)
        .single();
      if (!profile) return;

      const instId = profile.institution_id;

      const channel = supabase.channel('dashboard_notifications')
        // 1. Agendamento de visita
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'visit_appointments',
          filter: `institution_id=eq.${instId}`,
        }, (payload) => {
          const leadName = payload.new.lead_name || 'Um prospecto';
          const scheduledAt = payload.new.scheduled_at
            ? `${payload.new.scheduled_at.substring(8, 10)}/${payload.new.scheduled_at.substring(5, 7)} ${payload.new.scheduled_at.substring(11, 16)}`
            : '';
          addNotification({
            title: '📅 Visita Agendada',
            message: `${leadName}${scheduledAt ? ` — ${scheduledAt}` : ''}`,
            type: 'info',
          });
        })
        // 2. Nova pré-matrícula
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'enrollments',
          filter: `institution_id=eq.${instId}`,
        }, (payload) => {
          addNotification({
            title: '📋 Nova Pré-matrícula',
            message: `Uma pré-matrícula foi registrada no sistema.`,
            type: 'success',
          });
        })
        // 3. Novo lead capturado
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `institution_id=eq.${instId}`,
        }, (payload) => {
          addNotification({
            title: '🚀 Novo Lead',
            message: `${payload.new.name || 'Um novo prospecto'} entrou no funil.`,
            type: 'success',
          });
        })
        // 4. Nova conversa inbound (apenas primeira mensagem — direção inbound)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `institution_id=eq.${instId}`,
        }, async (payload) => {
          const { direction, conversation_id, content } = payload.new;
          if (direction !== 'inbound') return;

          // Verifica se é a primeira mensagem da conversa (nova conversa)
          const supabaseCli = createClient();
          const { count } = await supabaseCli
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation_id);

          if (count === 1) {
            addNotification({
              title: '💬 Nova Conversa',
              message: `${content?.substring(0, 60)}${(content?.length || 0) > 60 ? '...' : ''}`,
              type: 'info',
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    setupRealtime();
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationStateContext.Provider value={{ notifications, unreadCount }}>
      <NotificationDispatchContext.Provider value={{ addNotification, markAsRead, markAllAsRead, clearAll }}>
        {children}

        {/* Container de Toasts flutuantes premium (Canto inferior direito) */}
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '380px',
            width: '100%',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            let bgColor = 'rgba(23, 23, 37, 0.85)';
            let borderColor = 'rgba(255, 255, 255, 0.08)';
            let accentColor = '#3b82f6';
            
            if (t.type === 'success') {
              accentColor = '#10b981';
            } else if (t.type === 'warning') {
              accentColor = '#f59e0b';
            } else if (t.type === 'error') {
              accentColor = '#ef4444';
            }

            return (
              <div
                key={t.id}
                style={{
                  background: bgColor,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderLeft: `4px solid ${accentColor}`,
                  borderTop: `1px solid ${borderColor}`,
                  borderRight: `1px solid ${borderColor}`,
                  borderBottom: `1px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '16px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  pointerEvents: 'auto',
                  animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                    {t.title}
                  </h4>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {t.message}
                  </p>
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.4)',
                    cursor: 'pointer',
                    padding: '2px',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                    transition: 'color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)')}
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes toastSlideIn {
            from {
              transform: translateY(40px) scale(0.95);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }
        `}} />
      </NotificationDispatchContext.Provider>
    </NotificationStateContext.Provider>
  );
};

export const useNotificationState = () => {
  const context = useContext(NotificationStateContext);
  if (context === undefined) {
    throw new Error('useNotificationState must be used within a NotificationProvider');
  }
  return context;
};

export const useNotificationDispatch = () => {
  const context = useContext(NotificationDispatchContext);
  if (context === undefined) {
    throw new Error('useNotificationDispatch must be used within a NotificationProvider');
  }
  return context;
};

export const useNotification = () => {
  const state = useContext(NotificationStateContext);
  const dispatch = useContext(NotificationDispatchContext);
  if (state === undefined || dispatch === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return { ...state, ...dispatch };
};

