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

  // Carregar notificações salvas localmente para persistência leve inicial
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

  // Salvar notificações ao alterar
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

  // Inscrição em Tempo Real para eventos IMPORTANTES
  useEffect(() => {
    const supabase = createClient();
    
    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar o institution_id para filtrar o Realtime (RLS cuida disso, mas é bom ter no log)
      const { data: profile } = await supabase.from('profiles').select('institution_id').eq('id', user.id).single();
      if (!profile) return;

      const instId = profile.institution_id;

      const channel = supabase.channel('important_events')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'leads',
            filter: `institution_id=eq.${instId}`
        }, (payload) => {
            addNotification({
              title: 'Novo Lead Capturado 🚀',
              message: `${payload.new.name || 'Um novo prospecto'} acabou de entrar no funil.`,
              type: 'success'
            });
        })
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `institution_id=eq.${instId}`
        }, (payload) => {
            const { direction, content } = payload.new;
            
            if (direction === 'inbound') {
              addNotification({
                title: 'Nova Mensagem 💬',
                message: `Um cliente enviou: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                type: 'info'
              });
            } else if (direction === 'outbound_ai') {
              addNotification({
                title: 'Ação do Agente IA 🤖',
                message: `O agente respondeu automaticamente ao lead.`,
                type: 'info'
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
