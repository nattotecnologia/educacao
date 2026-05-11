'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, Calendar, CheckCircle2, Loader2, PlayCircle, Clock } from 'lucide-react';
import styles from './Campaigns.module.css';
import { getCampaigns } from './actions';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const data = await getCampaigns();
        setCampaigns(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'draft': return <span className={`${styles.badge} ${styles.badgeDraft}`}>Rascunho</span>;
      case 'scheduled': return <span className={`${styles.badge} ${styles.badgeScheduled}`}><Calendar size={12} /> Agendada</span>;
      case 'running': return <span className={`${styles.badge} ${styles.badgeRunning}`}><PlayCircle size={12} /> Executando</span>;
      case 'completed': return <span className={`${styles.badge} ${styles.badgeCompleted}`}><CheckCircle2 size={12} /> Concluída</span>;
      case 'failed': return <span className={`${styles.badge} ${styles.badgeFailed}`}>Falhou</span>;
      default: return <span className={styles.badge}>{status}</span>;
    }
  };

  if (loading) {
    return <div className={styles.loadingContainer}><Loader2 className="animate-spin" size={40} /></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}><Megaphone size={28} /> Campanhas de Disparo</h1>
          <p className={styles.subtitle}>Gerencie envios em massa de promoções e comunicados para seus leads.</p>
        </div>
        <Link href="/dashboard/campaigns/new" className={styles.primaryBtn}>
          <Plus size={18} /> Nova Campanha
        </Link>
      </header>

      {campaigns.length > 0 ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Agendado Para</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(camp => (
                <tr key={camp.id}>
                  <td className={styles.boldCell}>{camp.name}</td>
                  <td>{camp.type === 'promotion' ? 'Promoção' : 'Aviso'}</td>
                  <td>{getStatusBadge(camp.status)}</td>
                  <td>
                    {camp.scheduled_at 
                      ? new Date(camp.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : <span style={{color: 'var(--text-muted)'}}>-</span>
                    }
                  </td>
                  <td>{new Date(camp.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Megaphone size={48} />
          <h2>Nenhuma campanha encontrada</h2>
          <p>Você ainda não realizou nenhum disparo em massa. Crie uma nova campanha para enviar promoções aos seus leads.</p>
          <Link href="/dashboard/campaigns/new" className={styles.primaryBtn}>
            Criar Minha Primeira Campanha
          </Link>
        </div>
      )}
    </div>
  );
}
