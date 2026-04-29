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

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

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
  }, []);

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
          table: 'visits',
          filter: `institution_id=eq.${instId}`,
        }, (payload) => {
          const leadName = payload.new.lead_name || 'Um prospecto';
          const scheduledAt = payload.new.scheduled_at
            ? new Date(payload.new.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
