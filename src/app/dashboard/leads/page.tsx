'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Users, Search, Filter, MoreHorizontal, UserPlus, MessageCircle,
  Phone, Clock, Loader2, Bot, X, ChevronLeft, ChevronRight, CheckCircle2
} from 'lucide-react';
import { leadService } from '@/services';
import styles from './Leads.module.css';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

const STATUS_LIST = [
  { value: '', label: 'Todos' },
  { value: 'new', label: 'Novo' },
  { value: 'ai_handling', label: 'IA Atendendo' },
  { value: 'human_handling', label: 'Escalado para Humano' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Perdido' },
];

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Novo', color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246, 0.1)' },
  ai_handling: { label: 'IA Atendendo', color: 'var(--accent-secondary)', bg: 'rgba(139, 92, 246, 0.1)' },
  human_handling: { label: 'Escalado Humano', color: 'var(--accent-warning)', bg: 'rgba(245, 158, 11, 0.1)' },
  converted: { label: 'Convertido', color: 'var(--accent-success)', bg: 'rgba(16, 185, 129, 0.1)' },
  lost: { label: 'Perdido', color: 'var(--accent-danger)', bg: 'rgba(239, 68, 68, 0.1)' },
};

const PAGE_SIZE = 20;

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 400);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await leadService.getFiltered({
        search: debouncedSearch,
        status: filterStatus,
        page,
        pageSize: PAGE_SIZE,
      });
      setLeads(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterStatus, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setUpdatingId(leadId);
    try {
      const updated = await leadService.updateStatus(leadId, newStatus);
      setLeads(prev => prev.map(l => l.id === leadId ? updated : l));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gerenciamento de Leads</h1>
          <p className={styles.subtitle}>Gerencie os {total} contatos capturados e o processo de conversão.</p>
        </div>
        <Link href="/dashboard/leads/new" className="custom-button">
          <UserPlus size={18} />
          <span>Novo Lead</span>
        </Link>
      </div>

      <div className={`glass-panel ${styles.filterBar}`}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        <div className={styles.filterActions}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          >
            {STATUS_LIST.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`glass-panel ${styles.tableWrapper}`}>
        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 className="animate-spin" size={40} />
            <p>Carregando...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className={styles.loadingState}>
            <Users size={48} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Nenhum lead encontrado.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome / Telefone</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Data de entrada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className={styles.leadInfo}>
                      <span className={styles.leadName}>{lead.name || 'Sem Nome'}</span>
                      <span className={styles.leadPhone}>{lead.phone}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.statusBadge} style={{
                      color: statusMap[lead.status]?.color || 'var(--text-muted)',
                      background: statusMap[lead.status]?.bg || 'rgba(0,0,0,0.1)'
                    }}>
                      {statusMap[lead.status]?.label || lead.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.handlerInfo}>
                      {lead.ai_agent_id ? <Bot size={14} /> : <MessageCircle size={14} />}
                      <span>{lead.ai_agent_id ? 'Agente IA' : 'Manual'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.dateInfo}>
                      <Clock size={14} />
                      <span>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {updatingId === lead.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <button
                        className={styles.assumeBtn}
                        title="Assumir atendimento"
                        onClick={() => handleStatusChange(lead.id, 'human_handling')}
                        disabled={lead.status === 'human_handling' || lead.status === 'converted'}
                      >
                        <CheckCircle2 size={16} />
                        <span>Assumir</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>{total} leads · Pág. {page} de {totalPages}</span>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={16} />
            </button>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedLead && (
        <div className={styles.modalOverlay} onClick={() => setSelectedLead(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{selectedLead.name || 'Sem nome'}</h3>
              <button className={styles.closeBtn} onClick={() => setSelectedLead(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <Phone size={16} />
                <span>{selectedLead.phone}</span>
              </div>
              {selectedLead.notes && (
                <div className={styles.modalField}>
                  <MessageCircle size={16} />
                  <span>{selectedLead.notes}</span>
                </div>
              )}
              <div className={styles.modalField}>
                <Clock size={16} />
                <span>Criado em {new Date(selectedLead.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className={styles.modalStatusSection}>
                <p className={styles.modalLabel}>Alterar Status:</p>
                <div className={styles.statusBtns}>
                  {STATUS_LIST.filter(s => s.value).map(s => (
                    <button
                      key={s.value}
                      className={styles.statusBtn}
                      style={{
                        borderColor: selectedLead.status === s.value ? statusMap[s.value]?.color : 'var(--glass-border)',
                        color: selectedLead.status === s.value ? statusMap[s.value]?.color : 'var(--text-secondary)',
                        background: selectedLead.status === s.value ? statusMap[s.value]?.bg : 'transparent',
                      }}
                      onClick={() => handleStatusChange(selectedLead.id, s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
