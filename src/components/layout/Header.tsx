'use client';

import { Bell, Search, User, Check, Trash2, Moon, Sun, Calendar, Users, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useNotification, Notification } from '@/contexts/NotificationContext';
import styles from './Header.module.css';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'lead' | 'visit';
  href: string;
}

export default function Header() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const supabaseClient = createClient();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('institution_id')
        .eq('id', user.id)
        .single();
      if (!profileData) return;

      const instId = profileData.institution_id;
      const q = query.trim().toLowerCase();

      const [leadsRes, visitsRes] = await Promise.all([
        supabaseClient
          .from('leads')
          .select('id, name, phone')
          .eq('institution_id', instId)
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5),
        supabaseClient
          .from('visits')
          .select('id, lead_name, scheduled_at, status')
          .eq('institution_id', instId)
          .ilike('lead_name', `%${q}%`)
          .limit(4),
      ]);

      const results: SearchResult[] = [];

      (leadsRes.data || []).forEach((lead: any) => {
        results.push({
          id: lead.id,
          label: lead.name,
          sublabel: lead.phone || 'Lead',
          type: 'lead',
          href: `/dashboard/leads?search=${encodeURIComponent(lead.name)}`,
        });
      });

      (visitsRes.data || []).forEach((visit: any) => {
        const date = new Date(visit.scheduled_at).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
        results.push({
          id: visit.id,
          label: visit.lead_name,
          sublabel: `Visita • ${date}`,
          type: 'visit',
          href: '/dashboard/visits',
        });
      });

      setSearchResults(results);
      setShowSearchDropdown(results.length > 0);
    } catch {
      // silently fail search
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 300);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowSearchDropdown(false);
      router.push(`/dashboard/leads?search=${encodeURIComponent(searchQuery)}`);
    }
    if (e.key === 'Escape') {
      setShowSearchDropdown(false);
      setSearchQuery('');
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    router.push(result.href);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.searchContainer} ref={searchRef}>
        <Search className={styles.searchIcon} size={18} />
        <input
          type="text"
          placeholder="Pesquisar leads, agendamentos..."
          className={styles.searchInput}
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
          autoComplete="off"
        />
        {searchQuery && (
          <button className={styles.searchClear} onClick={clearSearch} title="Limpar">
            <X size={14} />
          </button>
        )}

        {showSearchDropdown && (
          <div className={styles.searchDropdown}>
            {isSearching ? (
              <div className={styles.searchLoading}>Buscando...</div>
            ) : (
              <>
                {searchResults.filter(r => r.type === 'lead').length > 0 && (
                  <div className={styles.searchCategory}>
                    <Users size={12} /> Leads
                  </div>
                )}
                {searchResults.filter(r => r.type === 'lead').map(result => (
                  <button key={result.id} className={styles.searchResultItem} onClick={() => handleResultClick(result)}>
                    <div className={styles.searchResultIcon} data-type="lead">
                      <Users size={14} />
                    </div>
                    <div className={styles.searchResultText}>
                      <span className={styles.searchResultLabel}>{result.label}</span>
                      {result.sublabel && <span className={styles.searchResultSub}>{result.sublabel}</span>}
                    </div>
                  </button>
                ))}

                {searchResults.filter(r => r.type === 'visit').length > 0 && (
                  <div className={styles.searchCategory}>
                    <Calendar size={12} /> Agendamentos
                  </div>
                )}
                {searchResults.filter(r => r.type === 'visit').map(result => (
                  <button key={result.id} className={styles.searchResultItem} onClick={() => handleResultClick(result)}>
                    <div className={styles.searchResultIcon} data-type="visit">
                      <Calendar size={14} />
                    </div>
                    <div className={styles.searchResultText}>
                      <span className={styles.searchResultLabel}>{result.label}</span>
                      {result.sublabel && <span className={styles.searchResultSub}>{result.sublabel}</span>}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
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
