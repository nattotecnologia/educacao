'use client';

import { Bell, Search, User, Check, Trash2, Moon, Sun } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useNotification, Notification } from '@/contexts/NotificationContext';
import styles from './Header.module.css';

export default function Header() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name, avatar_url, role').eq('id', user.id).single();
        if (data) setProfile(data);
      }
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/dashboard/leads?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.searchContainer}>
        <Search className={styles.searchIcon} size={18} />
        <input 
          type="text" 
          placeholder="Pesquisar leads, agentes..." 
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
        />
      </div>

      <div className={styles.actions}>
        {mounted && (
          <button 
            className={styles.iconButton}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )}

        <div className={styles.notificationWrapper} ref={dropdownRef}>
          <button 
            className={styles.iconButton} 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>

          {isDropdownOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <h4>Notificações</h4>
                <div className={styles.dropdownActions}>
                  <button onClick={markAllAsRead} title="Marcar todas como lidas">
                    <Check size={16} />
                  </button>
                  <button onClick={clearAll} title="Limpar todas">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.dropdownBody}>
                {notifications.length === 0 ? (
                  <p className={styles.emptyText}>Sem notificações no momento.</p>
                ) : (
                  notifications.map((notif: Notification) => (
                    <div 
                      key={notif.id} 
                      className={`${styles.notificationItem} ${!notif.read ? styles.unread : ''}`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className={`${styles.notifIndicator} ${styles[notif.type] || styles.info}`}></div>
                      <div className={styles.notifContent}>
                        <h5 className={styles.notifTitle}>{notif.title}</h5>
                        <p className={styles.notifMessage}>{notif.message}</p>
                        <span className={styles.notifTime}>{new Date(notif.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <Link href="/dashboard/profile" className={styles.profileBtn}>
          <div className={styles.avatar}>
            {profile?.avatar_url ? (
               <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
               <User size={18} />
            )}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{profile?.full_name || 'Admin'}</span>
            <span className={styles.userRole}>{profile?.role || 'Coordenador'}</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
