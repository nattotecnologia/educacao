'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { messageService, leadService } from '@/services';
import { 
  Search, User, Bot, UserCog, Send, Loader2, MessageSquare, ArrowLeft, Trash2,
  MoreVertical, CheckSquare, List
} from 'lucide-react';
import { maskPhone } from '@/utils/masks';
import styles from './Chat.module.css';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function ChatPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  
  // Estados para novas funcionalidades
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de "mais" ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const { data } = await leadService.getFiltered({ 
        search: debouncedSearch, 
        pageSize: 100,
        orderBy: 'updated_at',
        orderDirection: 'desc' 
      });
      setLeads(data);
    } catch (err) {
      console.error('Erro ao buscar leads', err);
    } finally {
      setLoadingLeads(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Inscrição em Tempo Real para a LISTA de LEADS (Barra Lateral)
  useEffect(() => {
    let channel: any;

    const setupRealtimeLeads = async () => {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      
      const channelId = `chat_sidebar_${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leads' },
          () => {
            fetchLeads();
          }
        )
        .subscribe();
    };

    setupRealtimeLeads();

    return () => {
      if (channel) {
        import('@/utils/supabase/client').then(m => {
          const supabase = m.createClient();
          supabase.removeChannel(channel);
        });
      }
    };
  }, [fetchLeads]);

  // SSE para mensagens em tempo real
  useEffect(() => {
    if (!selectedLead) return;

    const connectSSE = async () => {
      const supabase = await import('@/utils/supabase/client').then(m => m.createClient());
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoadingMessages(true);
      try {
        const initialMessages = await messageService.getMessages(selectedLead.id);
        setMessages(initialMessages);
      } catch (err) {
        console.error('Erro ao buscar mensagens iniciais', err);
      } finally {
        setLoadingMessages(false);
      }

      const eventSource = new EventSource(`/api/chat/stream?leadId=${selectedLead.id}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'messages' && parsed.data) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = parsed.data.filter((m: any) => !existingIds.has(m.id));
              return [...prev, ...newMsgs];
            });
          }
        } catch (err) {
          console.error('Erro ao processar evento SSE', err);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [selectedLead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !selectedLead) return;

    setSending(true);
    try {
      const novaMensagem = await messageService.sendMessage(selectedLead.id, draft);
      setMessages(prev => [...prev, novaMensagem]);
      setDraft('');
      setLeads(prev => {
        const idx = prev.findIndex(l => l.id === selectedLead.id);
        if (idx <= 0) return prev;
        const updated = { ...prev[idx], updated_at: new Date().toISOString() };
        const others = prev.filter(l => l.id !== selectedLead.id);
        return [updated, ...others];
      });
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleHandoff = async () => {
    if (!selectedLead) return;
    const newStatus = selectedLead.status === 'human_handling' ? 'ai_handling' : 'human_handling';
    try {
      const updated = await leadService.updateStatus(selectedLead.id, newStatus);
      setSelectedLead(updated);
      setLeads(leads.map(l => l.id === updated.id ? updated : l));
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  // Funções de Exclusão com Modal
  const openConfirmModal = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirmModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteSingle = () => {
    openConfirmModal(
      'Excluir Conversa',
      'Tem certeza que deseja excluir esta conversa? Todas as mensagens e o lead serão removidos permanentemente.',
      async () => {
        try {
          await leadService.delete(selectedLead.id);
          setSelectedLead(null);
          setLeads(prev => prev.filter(l => l.id !== selectedLead.id));
          closeConfirmModal();
        } catch (err: any) {
          alert('Erro ao excluir: ' + err.message);
        }
      }
    );
  };

  const handleDeleteSelected = () => {
    openConfirmModal(
      'Excluir Selecionados',
      `Tem certeza que deseja excluir as ${selectedIds.size} conversas selecionadas?`,
      async () => {
        try {
          await leadService.deleteMany(Array.from(selectedIds));
          setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
          if (selectedLead && selectedIds.has(selectedLead.id)) setSelectedLead(null);
          setSelectedIds(new Set());
          setIsSelectionMode(false);
          closeConfirmModal();
        } catch (err: any) {
          alert('Erro ao excluir selecionados: ' + err.message);
        }
      }
    );
  };

  const handleDeleteAll = () => {
    openConfirmModal(
      'Limpar Todas as Conversas',
      'ATENÇÃO: Isso excluirá permanentemente TODOS os leads e conversas do sistema. Esta ação não pode ser desfeita. Deseja continuar?',
      async () => {
        try {
          await leadService.deleteAll();
          setLeads([]);
          setSelectedLead(null);
          setSelectedIds(new Set());
          setIsSelectionMode(false);
          setIsMoreMenuOpen(false);
          closeConfirmModal();
        } catch (err: any) {
          alert('Erro ao excluir tudo: ' + err.message);
        }
      }
    );
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleLeadClick = (lead: any) => {
    if (isSelectionMode) {
      const newSet = new Set(selectedIds);
      if (newSet.has(lead.id)) newSet.delete(lead.id);
      else newSet.add(lead.id);
      setSelectedIds(newSet);
    } else {
      setSelectedLead(lead);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'human_handling') return 'var(--accent-warning)';
    if (status === 'ai_handling') return 'var(--accent-secondary)';
    return 'var(--text-muted)';
  };

  return (
    <div className={`${styles.container} ${selectedLead ? styles.showChat : styles.showSidebar}`}>
      
      {/* SIDEBAR */}
      <div className={`glass-panel ${styles.sidebar}`}>
        <div className={styles.sidebarHeader}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 className={styles.title}>Atendimentos</h2>
            
            <div className={styles.moreMenuContainer} ref={moreMenuRef}>
              <button className={styles.moreBtn} onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
                <MoreVertical size={20} />
              </button>
              
              {isMoreMenuOpen && (
                <div className={styles.dropdown}>
                  <button className={styles.dropdownItem} onClick={() => { setIsSelectionMode(true); setIsMoreMenuOpen(false); }}>
                    <CheckSquare size={16} /> Selecionar conversas
                  </button>
                  <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={handleDeleteAll}>
                    <Trash2 size={16} /> Excluir todas
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Buscar lead..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isSelectionMode && (
          <div className={styles.bulkActions}>
            <span className={styles.bulkCount}>{selectedIds.size} selecionados</span>
            <div className={styles.bulkButtons}>
              <button className={`${styles.bulkBtn} ${styles.cancelSelected}`} onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}>
                Cancelar
              </button>
              {selectedIds.size > 0 && (
                <button className={`${styles.bulkBtn} ${styles.deleteSelected}`} onClick={handleDeleteSelected}>
                  Excluir
                </button>
              )}
            </div>
          </div>
        )}
        
        <div className={styles.leadsList}>
          {loadingLeads ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <Loader2 className="animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : leads.map(lead => (
            <div 
              key={lead.id} 
              className={`${styles.leadItem} ${selectedLead?.id === lead.id ? styles.leadItemActive : ''}`}
              onClick={() => handleLeadClick(lead)}
            >
              <div className={`${styles.checkboxContainer} ${isSelectionMode ? styles.checkboxVisible : styles.checkboxHidden}`}>
                <input 
                  type="checkbox" 
                  className={styles.checkbox} 
                  checked={selectedIds.has(lead.id)}
                  readOnly
                />
              </div>
              <div className={styles.leadAvatar}>
                <User size={20} />
              </div>
              <div className={styles.leadInfo}>
                <span className={styles.leadName}>{lead.name || 'Sem Nome'}</span>
                <span className={styles.leadPhone}>{maskPhone(lead.phone)}</span>
              </div>
              {!isSelectionMode && (
                <div 
                  className={styles.statusIndicator} 
                  style={{ background: getStatusColor(lead.status) }}
                  title={lead.status === 'human_handling' ? 'Atendimento Humano' : 'IA Atendendo'}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className={`glass-panel ${styles.chatArea}`}>
        {selectedLead ? (
          <>
            <div className={styles.chatHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className={styles.backBtn} onClick={() => setSelectedLead(null)}>
                  <ArrowLeft size={20} />
                </button>
                <div className={styles.chatHeaderInfo}>
                  <div className={styles.leadAvatar}><User size={20} /></div>
                  <div>
                    <div className={styles.headerName}>{selectedLead.name || maskPhone(selectedLead.phone)}</div>
                    <div className={styles.headerStatus}>
                      {selectedLead.status === 'human_handling' ? (
                        <><UserCog size={12} color="var(--accent-warning)" /> Humano assumiu</>
                      ) : (
                        <><Bot size={12} color="var(--accent-secondary)" /> IA atendendo</>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.headerActions}>
                <button 
                  className={`${styles.actionBtn} ${selectedLead.status === 'human_handling' ? styles.ai : styles.human}`}
                  onClick={toggleHandoff}
                >
                  {selectedLead.status === 'human_handling' ? <><Bot size={16} /> IA</> : <><UserCog size={16} /> Assumir</>}
                </button>
                <button className={styles.deleteSingleBtn} onClick={handleDeleteSingle}>
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className={styles.messagesList}>
               {loadingMessages ? (
                 <Loader2 className="animate-spin" style={{ margin: 'auto' }} />
               ) : messages.length === 0 ? (
                 <div className={styles.emptyState}>
                   <MessageSquare size={32} opacity={0.5} />
                   <p>Nenhuma mensagem ainda.</p>
                 </div>
               ) : messages.map((msg) => (
                 <div 
                   key={msg.id} 
                   className={`${styles.messageBubble} ${
                     msg.direction === 'inbound' ? styles.messageInbound :
                     msg.direction === 'outbound_ai' ? styles.messageOutboundAi : 
                     styles.messageOutboundHuman
                   }`}
                 >
                   <div>{msg.content}</div>
                   <span className={styles.messageTime}>
                     {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     {msg.direction === 'outbound_ai' && ' • IA'}
                     {msg.direction === 'outbound_human' && ' • Você'}
                   </span>
                 </div>
               ))}
               <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <form onSubmit={handleSend} className={styles.inputForm}>
                <textarea 
                  className={styles.messageInput} 
                  placeholder={selectedLead.status === 'human_handling' ? "Digite sua mensagem..." : "Assuma para responder"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                  disabled={selectedLead.status !== 'human_handling'}
                />
                <button type="submit" className={styles.sendBtn} disabled={selectedLead.status !== 'human_handling' || !draft.trim() || sending}>
                  {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <MessageSquare size={64} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <h2>Selecione um atendimento</h2>
            <p>Escolha um lead na barra lateral para ver o histórico.</p>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO PREMIUM */}
      {modalConfig.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>{modalConfig.title}</h3>
            <p className={styles.modalContent}>{modalConfig.message}</p>
            <div className={styles.modalFooter}>
              <button className={`${styles.modalBtn} ${styles.cancelBtn}`} onClick={closeConfirmModal}>
                Cancelar
              </button>
              <button className={`${styles.modalBtn} ${styles.confirmBtn}`} onClick={modalConfig.onConfirm}>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
