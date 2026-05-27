'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, Calendar, CheckCircle2, Loader2, PlayCircle, Clock, Save, BellRing, Edit, Trash2, Eye, X } from 'lucide-react';
import styles from './Campaigns.module.css';
import { getCampaigns, getRemindersSettings, updateRemindersSettings, deleteCampaign, getCampaignLogs } from './actions';
import { useNotificationDispatch } from '@/contexts/NotificationContext';
import { maskPhone } from '@/utils/masks';

export default function CampaignsPage() {
  const { addNotification } = useNotificationDispatch();
  
  const [activeTab, setActiveTab] = useState<'promocoes' | 'lembretes'>('promocoes');
  
  // States - Promotions Tab
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States - Reminders Tab
  const [reminderMinutes, setReminderMinutes] = useState(120);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderActive, setReminderActive] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);

  // Modal logs
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignLogs, setCampaignLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [campsData, reminderData] = await Promise.all([
          getCampaigns(),
          getRemindersSettings()
        ]);
        
        setCampaigns(campsData || []);
        
        if (reminderData) {
          setReminderMinutes(reminderData.visit_reminder_minutes || 120);
          setReminderMessage(reminderData.visit_reminder_message || '');
          setReminderActive(reminderData.visit_reminder_active ?? true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReminder(true);
    try {
      await updateRemindersSettings(reminderMinutes, reminderMessage, reminderActive);
      addNotification({ type: 'success', title: 'Salvo', message: 'Configurações de lembrete atualizadas!' });
    } catch (err) {
      addNotification({ type: 'error', title: 'Erro', message: 'Falha ao salvar lembrete' });
    } finally {
      setSavingReminder(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha permanentemente?')) return;
    
    try {
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      addNotification({ type: 'success', title: 'Sucesso', message: 'Campanha excluída.' });
    } catch (err) {
      addNotification({ type: 'error', title: 'Erro', message: 'Não foi possível excluir a campanha.' });
    }
  };

  const handleViewLogs = async (campaign: any) => {
    setSelectedCampaign(campaign);
    setLoadingLogs(true);
    try {
      const logs = await getCampaignLogs(campaign.id);
      setCampaignLogs(logs || []);
    } catch (err) {
      addNotification({ type: 'error', title: 'Erro', message: 'Não foi possível carregar relatório.' });
    } finally {
      setLoadingLogs(false);
    }
  };

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
      <header className={styles.header} style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className={styles.title}><Megaphone size={28} /> Central de Disparos</h1>
          <p className={styles.subtitle}>Gerencie envios em massa e automações de lembretes.</p>
        </div>
        {activeTab === 'promocoes' && (
          <Link href="/dashboard/campaigns/new" className={styles.primaryBtn}>
            <Plus size={18} /> Novo Disparo
          </Link>
        )}
      </header>

      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'promocoes' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('promocoes')}
        >
          <Megaphone size={16} /> Disparos Promocionais
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'lembretes' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('lembretes')}
        >
          <BellRing size={16} /> Lembretes de Agendamento
        </button>
      </div>

      {activeTab === 'promocoes' && (
        <div className={styles.tabContent}>
          {campaigns.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome da Campanha</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Agendado Para</th>
                    <th>Criada em</th>
                    <th>Ações</th>
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
                          ? `${camp.scheduled_at.substring(8, 10)}/${camp.scheduled_at.substring(5, 7)} ${camp.scheduled_at.substring(11, 16)}`
                          : <span style={{color: 'var(--text-muted)'}}>-</span>
                        }
                      </td>
                      <td>{new Date(camp.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleViewLogs(camp)} 
                            className={styles.actionBtn} 
                            title="Ver Relatório"
                          >
                            <Eye size={16} />
                          </button>
                          {['draft', 'scheduled'].includes(camp.status) && (
                            <Link href={`/dashboard/campaigns/new?edit=${camp.id}`} className={styles.actionBtn} title="Editar">
                              <Edit size={16} />
                            </Link>
                          )}
                          <button 
                            onClick={() => handleDeleteCampaign(camp.id)} 
                            className={styles.actionBtn} 
                            style={{ color: 'var(--error)' }}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Megaphone size={48} />
              <h2>Nenhum disparo encontrado</h2>
              <p>Você ainda não realizou nenhum disparo em massa. Crie uma nova campanha para enviar promoções aos seus leads.</p>
              <Link href="/dashboard/campaigns/new" className={styles.primaryBtn}>
                Criar Meu Primeiro Disparo
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lembretes' && (
        <div className={styles.tabContent}>
          <form onSubmit={handleSaveReminder} className={styles.formCard} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--accent-primary)' }}>
                <BellRing size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Lembrete de Visita</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configure o aviso automático que os leads receberão antes da visita na unidade.</p>
              </div>
              
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: reminderActive ? '#10b981' : 'var(--text-muted)' }}>
                  {reminderActive ? 'Ativado' : 'Desativado'}
                </span>
                <label className={styles.toggleSwitch}>
                  <input 
                    type="checkbox" 
                    checked={reminderActive} 
                    onChange={(e) => setReminderActive(e.target.checked)}
                  />
                  <span className={styles.toggleSlider}></span>
                </label>
              </div>
            </div>

            <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Antecedência do Disparo</label>
              <p className={styles.hint} style={{marginBottom: '0.5rem'}}>Quanto tempo antes da visita o lead deve receber a mensagem?</p>
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {[15, 30, 60, 120, 1440].map((mins) => {
                  let label = `${mins} minutos`;
                  if (mins === 60) label = '1 hora';
                  if (mins === 120) label = '2 horas';
                  if (mins === 1440) label = '1 dia';

                  return (
                    <button
                      key={mins}
                      type="button"
                      className={`${styles.presetBtn} ${reminderMinutes === mins ? styles.presetBtnActive : ''}`}
                      onClick={() => setReminderMinutes(mins)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span className={styles.hint}>Ou tempo personalizado:</span>
                <input 
                  type="number" 
                  min="1"
                  value={reminderMinutes} 
                  onChange={(e) => setReminderMinutes(parseInt(e.target.value) || 15)}
                  className={styles.input} 
                  style={{ maxWidth: '100px' }}
                />
                <span className={styles.hint}>minutos antes</span>
              </div>
            </div>

            <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Mensagem do Lembrete</label>
              <textarea 
                value={reminderMessage} 
                onChange={(e) => setReminderMessage(e.target.value)}
                className={styles.input}
                style={{ minHeight: '120px', resize: 'vertical' }}
                placeholder="Olá {nome}! Passando para lembrar da sua visita agendada conosco hoje às {horario} na {instituicao}! Te esperamos!"
              />
              <span className={styles.hint} style={{ marginTop: '0.5rem', display: 'block' }}>
                Variáveis disponíveis: <code>{'{nome}'}</code>, <code>{'{horario}'}</code>, <code>{'{instituicao}'}</code>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" className={styles.primaryBtn} disabled={savingReminder}>
                {savingReminder ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Salvar Configurações</>}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal de Relatório */}
      {selectedCampaign && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCampaign(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Relatório: {selectedCampaign.name}</h3>
              <button className={styles.closeBtn} onClick={() => setSelectedCampaign(null)}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total na Fila</span>
                  <h4 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>{campaignLogs.length}</h4>
                </div>
                <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Enviados</span>
                  <h4 style={{ fontSize: '1.5rem', margin: '0.2rem 0', color: '#10b981' }}>{campaignLogs.filter(l => l.status === 'sent').length}</h4>
                </div>
                <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Falhas</span>
                  <h4 style={{ fontSize: '1.5rem', margin: '0.2rem 0', color: '#ef4444' }}>{campaignLogs.filter(l => l.status === 'failed').length}</h4>
                </div>
              </div>

              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Lista de Destinatários</h4>
              
              {loadingLogs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 size={24} className="animate-spin" /></div>
              ) : campaignLogs.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Nenhum registro encontrado na fila.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.logTable}>
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Telefone</th>
                        <th>Status</th>
                        <th>Data/Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontWeight: 500 }}>{log.leads?.name || 'Desconhecido'}</td>
                          <td>{maskPhone(log.leads?.phone || '')}</td>
                          <td>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 600, 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '4px',
                              background: log.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : log.status === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100,100,100,0.15)',
                              color: log.status === 'sent' ? '#10b981' : log.status === 'failed' ? '#ef4444' : 'var(--text-muted)'
                            }}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: log.status === 'failed' ? '#ef4444' : 'var(--text-muted)' }}>
                            {log.status === 'sent' && log.sent_at ? new Date(log.sent_at).toLocaleString('pt-BR') : log.error_log || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
