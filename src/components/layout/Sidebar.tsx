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
  Smartphone,
  KanbanSquare,
  BookOpen,
  GraduationCap,
  CalendarDays
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
    { name: 'Visão Geral', icon: LayoutDashboard, path: '/dashboard', group: 'crm' },
    { name: 'Kanban', icon: KanbanSquare, path: '/dashboard/pipeline', group: 'crm' },
    { name: 'Leads (Em Massa)', icon: Users, path: '/dashboard/leads', group: 'crm' },
    { name: 'Chat (Handoff)', icon: MessageSquare, path: '/dashboard/chat', group: 'crm' },
    { name: 'Cursos', icon: BookOpen, path: '/dashboard/courses', group: 'academic' },
    { name: 'Matrículas', icon: GraduationCap, path: '/dashboard/enrollments', group: 'academic' },
    { name: 'Agendamentos', icon: CalendarDays, path: '/dashboard/visits', group: 'academic' },
    { name: 'Agentes IA', icon: Bot, path: '/dashboard/agents', group: 'automation' },
    { name: 'WhatsApp', icon: Smartphone, path: '/dashboard/whatsapp', group: 'automation' },
    { name: 'Configurações', icon: Settings, path: '/dashboard/settings', group: 'system' },
  ];

  const groupLabels: Record<string, string> = {
    crm: 'Gestão CRM',
    academic: 'Acadêmico',
    automation: 'Conexões & IA',
    system: 'Sistema',
  };

  const groups = ['crm', 'academic', 'automation', 'system'];

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
        {groups.map((group) => {
          const groupItems = menuItems.filter(i => i.group === group);
          return (
            <div key={group}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.75rem 0.75rem 0.25rem', marginTop: group !== 'crm' ? '0.5rem' : 0 }}>
                {groupLabels[group]}
              </div>
              {groupItems.map((item, index) => {
                const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
                const isHiddenOnMobile = index > 2;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`${styles.navItem} ${isActive ? styles.active : ''} ${isHiddenOnMobile ? styles.desktopOnly : ''}`}
                  >
                    <div className={styles.iconWrapper}>
                      <item.icon size={20} className={styles.icon} />
                      {item.name.includes('Chat') && (
                        <div className={styles.notificationDot} />
                      )}
                    </div>
                    <span>{item.name.replace(' (Handoff)', '')}</span>
                  </Link>
                );
              })}
            </div>
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
