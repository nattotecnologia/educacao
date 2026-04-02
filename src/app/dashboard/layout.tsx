import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { ReactNode } from 'react';

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
