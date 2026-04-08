'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/services';
import { 
  LayoutDashboard, 
  Users, 
  Bot, 
  Settings, 
  LogOut,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useBranding } from '@/contexts/BrandingContext';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeLogo = theme === 'dark' ? branding?.logo_light_url : branding?.logo_dark_url;

  const handleLogout = async () => {
    try {
      await authService.logout();
      router.push('/login');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const menuItems = [
    { name: 'Visão Geral', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Leads', icon: Users, path: '/dashboard/leads' },
    { name: 'Chat (Handoff)', icon: MessageSquare, path: '/dashboard/chat' },
    { name: 'Agentes IA', icon: Bot, path: '/dashboard/agents' },
    { name: 'API WhatsApp', icon: Smartphone, path: '/dashboard/whatsapp' },
    { name: 'Configurações', icon: Settings, path: '/dashboard/settings' },
  ];

  return (
    <aside className="sidebar">
      <div className={styles.logoContainer}>
        {mounted && activeLogo ? (
          <img src={activeLogo} alt="Logo" className={styles.dynamicLogo} />
        ) : (
          <>
            <div className={styles.logoIcon}>AI</div>
            <h2 className={styles.logoText}>EduDashboard</h2>
          </>
        )}
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.name} 
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <item.icon size={20} className={styles.icon} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={20} className={styles.icon} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
