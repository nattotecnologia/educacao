import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('institution_id')
        .eq('id', user.id)
        .single();

      if (profile?.institution_id) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('name')
          .eq('id', profile.institution_id)
          .single();

        if (inst?.name) {
          return {
            title: `${inst.name} | Dashboard`,
          };
        }
      }
    }
  } catch (error) {
    // Falha silenciosa para metadados
  }

  return {
    title: 'Dashboard',
  };
}
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="animate-in">
          {children}
        </main>
      </div>
    </div>
  );
}
