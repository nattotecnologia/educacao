'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, Search, Filter, MoreHorizontal, UserPlus, MessageCircle,
  Phone, Clock, Loader2, Bot, X, ChevronLeft, ChevronRight, CheckCircle2,
  Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Calendar, FileText
} from 'lucide-react';
import { leadService, visitService } from '@/services';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useNotificationDispatch } from '@/contexts/NotificationContext';
import { maskPhone } from '@/utils/masks';
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationDispatch();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    action: async () => {}
  });

  // Estados Unificados de Filtros e Paginação
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    page: 1,
    pageSize: 20,
    sortField: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc'
  });

  // Estado derivado para o lead selecionado (detalhes no modal)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const querySearch = searchParams.get('search');

  // Sincroniza busca vinda da URL (Navbar)
  useEffect(() => {
    if (querySearch !== null) {
      setFilters(prev => ({ ...prev, search: querySearch, page: 1 }));
    }
  }, [querySearch]);

  const debouncedSearch = useDebounce(filters.search, 400);

  // Query reativa para lista de leads com TanStack Query
  const { data: leadsResponse, isLoading: loading } = useQuery({
    queryKey: ['leads', debouncedSearch, filters.status, filters.page, filters.pageSize, filters.sortField, filters.sortOrder],
    queryFn: () => leadService.getFiltered({
      search: debouncedSearch,
      status: filters.status,
      page: filters.page,
      pageSize: filters.pageSize,
      orderBy: filters.sortField,
      orderDirection: filters.sortOrder,
    })
  });
  
  const leads = leadsResponse?.data || [];
  const total = leadsResponse?.total || 0;

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null;

  // Query reativa para visitas do lead selecionado
  const { data: leadVisits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['visits', selectedLeadId],
    queryFn: () => visitService.getByLeadId(selectedLeadId!),
    enabled: !!selectedLeadId
  });

  // Mutações estruturadas para modificação e persistência de dados com TanStack Query
  const statusMutation = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: string }) => leadService.updateStatus(leadId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => leadService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setUpdatingId(leadId);
    try {
      await statusMutation.mutateAsync({ leadId, status: newStatus });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, lead: any) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Lead',
      message: `Tem certeza que deseja excluir o lead ${lead.name || lead.phone}? Esta ação não pode ser desfeita.`,
      type: 'danger',
      action: async () => {
        setIsDeleting(lead.id);
        try {
          await deleteMutation.mutateAsync(lead.id);
          addNotification({
            title: 'Lead Excluído',
            message: 'O lead foi removido com sucesso.',
            type: 'success',
          });
        } catch (err) {
          addNotification({
            title: 'Erro',
            message: 'Não foi possível excluir o lead.',
            type: 'error',
          });
        } finally {
          setIsDeleting(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const openEditModal = (e: React.MouseEvent, lead: any) => {
    e.stopPropagation();
    setEditLead(lead);
    setEditForm({ name: lead.name || '', phone: lead.phone || '' });
  };

  const handleUpdate = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Atualizar Lead',
      message: `Corrigir os dados do lead para os novos valores informados?`,
      type: 'warning',
      action: async () => {
        try {
          await updateMutation.mutateAsync({ id: editLead.id, payload: { name: editForm.name, phone: editForm.phone } });
          addNotification({
            title: 'Lead Atualizado',
            message: 'Os dados do lead foram atualizados com sucesso.',
            type: 'success',
          });
          setEditLead(null);
        } catch (err) {
          addNotification({
            title: 'Erro',
            message: 'Não foi possível atualizar o lead.',
            type: 'error',
          });
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSort = (field: string) => {
    setFilters(prev => {
      const isSameField = prev.sortField === field;
      const nextOrder = isSameField && prev.sortOrder === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sortField: field,
        sortOrder: isSameField ? nextOrder : 'desc',
        page: 1
      };
    });
  };

  const getSortIcon = (field: string) => {
    if (filters.sortField !== field) return <ArrowUpDown size={14} className={styles.sortIcon} />;
    return filters.sortOrder === 'asc' ? 
      <ArrowUp size={14} className={styles.sortIconActive} /> : 
      <ArrowDown size={14} className={styles.sortIconActive} />;
  };

  const totalPages = Math.ceil(total / filters.pageSize);

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
            value={filters.search}
            onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value, page: 1 })); }}
          />
        </div>
        <div className={styles.filterActions}>
          <div className={styles.pageSizeControl}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mostrar:</span>
            <select
              className={styles.filterSelect}
              value={filters.pageSize}
              onChange={(e) => { setFilters(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 })); }}
            >
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className={styles.statusControl}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className={styles.filterSelect}
              value={filters.status}
              onChange={(e) => { setFilters(prev => ({ ...prev, status: e.target.value, page: 1 })); }}
            >
              {STATUS_LIST.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
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
                <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                  <div className={styles.headerContent}>
                    <span>Nome / Telefone</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className={styles.sortableHeader}>
                  <div className={styles.headerContent}>
                    <span>Status</span>
                    {getSortIcon('status')}
                  </div>
                </th>
                <th>Origem</th>
                <th onClick={() => handleSort('created_at')} className={styles.sortableHeader}>
                  <div className={styles.headerContent}>
                    <span>Data de entrada</span>
                    {getSortIcon('created_at')}
                  </div>
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className={styles.leadInfo}>
                      <span className={styles.leadName}>{lead.name || 'Sem Nome'}</span>
                      <span className={styles.leadPhone}>{maskPhone(lead.phone)}</span>
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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                      <button
                        className={styles.iconButton}
                        title="Editar Lead"
                        onClick={(e) => openEditModal(e, lead)}
                      >
                        <Edit2 size={16} />
                      </button>
                      {isDeleting === lead.id ? (
                        <Loader2 className="animate-spin" size={16} color="var(--accent-danger)" />
                      ) : (
                        <button
                          className={styles.iconButton}
                          title="Excluir Lead"
                          style={{ color: 'var(--accent-danger)' }}
                          onClick={(e) => handleDelete(e, lead)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>{total} leads · Pág. {filters.page} de {totalPages}</span>
            <button className={styles.pageBtn} onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))} disabled={filters.page === 1}>
              <ChevronLeft size={16} />
            </button>
            <button className={styles.pageBtn} onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))} disabled={filters.page === totalPages}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedLead && (
        <div className={styles.modalOverlay} onClick={() => setSelectedLeadId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{selectedLead.name || 'Sem nome'}</h3>
              <button className={styles.closeBtn} onClick={() => setSelectedLeadId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <Phone size={16} />
                <span>{maskPhone(selectedLead.phone)}</span>
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

              {/* Seção de Agendamentos */}
              <div className={styles.visitsSection}>
                <h4 className={styles.sectionTitle}>
                  <Calendar size={16} /> Agendamentos de Visita
                </h4>
                
                {loadingVisits ? (
                  <div className={styles.visitsLoading}>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Buscando agendamentos...</span>
                  </div>
                ) : leadVisits.length === 0 ? (
                  <p className={styles.noVisits}>Nenhum agendamento encontrado para este lead.</p>
                ) : (
                  <div className={styles.visitsList}>
                    {leadVisits.map(visit => {
                      const [year, month, day, hour, min] = visit.scheduled_at.substring(0, 16).split(/[-T:]/);
                      const date = `${day}/${month}/${year} ${hour}:${min}`;
                      
                      const visitStatusMap: any = {
                        scheduled: { label: 'Agendada', color: '#3b82f6' },
                        confirmed: { label: 'Confirmada', color: '#10b981' },
                        done: { label: 'Finalizada', color: '#8b5cf6' },
                        cancelled: { label: 'Cancelada', color: '#ef4444' },
                        no_show: { label: 'Faltou', color: '#94a3b8' }
                      };
                      const st = visitStatusMap[visit.status] || { label: visit.status, color: '#94a3b8' };

                      return (
                        <div key={visit.id} className={styles.visitItem}>
                          <div className={styles.visitHeader}>
                            <span className={styles.visitDate}>{date}</span>
                            <span className={styles.visitStatus} style={{ color: st.color, borderColor: st.color }}>
                              {st.label}
                            </span>
                          </div>
                          {visit.notes && (
                            <div className={styles.visitNotes}>
                              <FileText size={12} />
                              <span>{visit.notes}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Edição */}
      {editLead && (
        <div className={styles.modalOverlay} onClick={() => setEditLead(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Editar Lead</h3>
              <button className={styles.closeBtn} onClick={() => setEditLead(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome do Lead</label>
                  <input 
                    type="text" 
                    className="custom-input" 
                    value={editForm.name} 
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Telefone</label>
                  <input 
                    type="text" 
                    className="custom-input" 
                    value={editForm.phone} 
                    onChange={e => setEditForm({ ...editForm, phone: maskPhone(e.target.value) })} 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="custom-button" style={{ background: 'transparent', border: '1px solid var(--glass-border)' }} onClick={() => setEditLead(null)}>
                  Cancelar
                </button>
                <button className="custom-button" onClick={handleUpdate}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm global da tela */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        onConfirm={confirmConfig.action}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
