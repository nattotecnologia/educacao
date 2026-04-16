'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { 
  CalendarDays, Plus, Loader2, CheckCircle, XCircle, 
  AlertCircle, Clock, ChevronLeft, ChevronRight, Search, Filter 
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { maskPhone } from '@/utils/masks';
import './calendar.css';

interface Visit {
  id: string;
  lead_name: string;
  lead_phone?: string;
  scheduled_at: string;
  status: string;
  notes?: string;
  leads?: { name: string; phone: string };
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: 'Agendada', color: 'var(--accent-primary)', icon: Clock },
  confirmed: { label: 'Confirmada', color: '#10b981', icon: CheckCircle },
  done: { label: 'Realizada', color: '#6366f1', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: '#ef4444', icon: XCircle },
  no_show: { label: 'Não compareceu', color: '#94a3b8', icon: AlertCircle },
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00

export default function VisitsPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: () => void;
    type: 'danger' | 'primary';
  }>({
    show: false,
    title: '',
    message: '',
    action: () => {},
    type: 'primary'
  });
  
  const [form, setForm] = useState({
    lead_name: '', lead_phone: '', scheduled_at: '', notes: '', lead_id: '',
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSuggestions, setLeadSuggestions] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setFormField = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const handleLeadSearch = async (val: string) => {
    setLeadSearch(val);
    setFormField('lead_name', val);
    setFormField('lead_id', ''); // Limpa ID se o usuário estiver digitando manualmente
    
    if (val.length < 2) {
      setLeadSuggestions([]);
      return;
    }
    const filtered = leads.filter(l => 
        l.name?.toLowerCase().includes(val.toLowerCase()) || 
        l.phone?.includes(val)
      );
      setLeadSuggestions(filtered);
  };

  const selectLead = (lead: any) => {
    setForm(prev => ({ 
      ...prev, 
      lead_id: lead.id, 
      lead_name: lead.name, 
      lead_phone: maskPhone(lead.phone || '') 
    }));
    setLeadSearch(lead.name);
    setLeadSuggestions([]);
  };

  // Date Helpers
  const displayDays = useMemo(() => {
    if (view === 'day') return [currentDate];
    
    if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
      });
    }

    if (view === 'month') {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const startDay = startOfMonth.getDay();
      const diff = startDay === 0 ? -6 : 1 - startDay; // Mon start
      const firstCalendarDay = new Date(startOfMonth);
      firstCalendarDay.setDate(diff + startOfMonth.getDate());
      
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(firstCalendarDay);
        d.setDate(firstCalendarDay.getDate() + i);
        return d;
      });
    }

    return [];
  }, [currentDate, view]);

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
  const yearName = currentDate.getFullYear();

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      
      const res = await fetch(`/api/visits?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const normalizedData = (data || []).map((v: any) => ({
        ...v,
        scheduled_at: v.scheduled_at.substring(0, 19)
      }));
      setVisits(normalizedData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    
    const fullDateTime = new Date(`${editForm.scheduled_date}T${editForm.scheduled_time}`);
    const nowBrtObj = new Date(new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T'));
    const apptStrObj = new Date(`${editForm.scheduled_date}T${editForm.scheduled_time}`);

    if (apptStrObj < nowBrtObj && apptStrObj.getTime() !== new Date(selectedVisit.scheduled_at.substring(0, 19)).getTime()) {
      setError('Não é possível reagendar para o passado.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/visits/${selectedVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          lead_phone: editForm.lead_phone,
          scheduled_at: `${editForm.scheduled_date}T${editForm.scheduled_time}:00Z`,
          notes: editForm.notes,
          status: editForm.status
        }),
      });

      if (!res.ok) throw new Error('Falha ao atualizar');
      
      setIsEditing(false);
      setSelectedVisit(null);
      setConfirmModal(prev => ({ ...prev, show: false }));
      fetchVisits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVisit) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/visits/${selectedVisit.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (!res.ok) throw new Error('Falha ao excluir');
      
      setSelectedVisit(null);
      setConfirmModal(prev => ({ ...prev, show: false }));
      fetchVisits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchVisits();
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('institution_id').eq('id', user.id).single();
      if (!profile) return;
      const { data } = await supabase.from('leads').select('id, name, phone').eq('institution_id', profile.institution_id).order('name');
      setLeads(data || []);
    })();
  }, [fetchVisits]);

  const navigateDate = (amount: number) => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(currentDate.getDate() + amount);
    else if (view === 'week') next.setDate(currentDate.getDate() + (amount * 7));
    else if (view === 'month') next.setMonth(currentDate.getMonth() + amount);
    setCurrentDate(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lead_name || !scheduledDate || !scheduledTime) { 
      setError('Nome, data e horário são obrigatórios.'); 
      return; 
    }

    const apptStrObj = new Date(`${scheduledDate}T${scheduledTime}:00`);
    const nowBrtObj = new Date(new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T'));

    if (apptStrObj < nowBrtObj) {
      setError('Não é possível agendar visitas em datas ou horários passados.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          ...form, 
          scheduled_at: `${scheduledDate}T${scheduledTime}:00Z`,
          lead_id: form.lead_id || null 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNewForm(false);
      setForm({ lead_name: '', lead_phone: '', scheduled_at: '', notes: '', lead_id: '' });
      setScheduledDate('');
      setScheduledTime('');
      setLeadSearch('');
      setLeadSuggestions([]);
      fetchVisits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredVisits = visits.filter(v => 
    v.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAppointmentsForCell = (date: Date, hour: number) => {
    return filteredVisits.filter(v => {
      const vDate = new Date(v.scheduled_at);
      return vDate.getDate() === date.getDate() && 
             vDate.getMonth() === date.getMonth() &&
             vDate.getFullYear() === date.getFullYear() &&
             vDate.getHours() === hour;
    });
  };

  const getAppointmentsForDay = (date: Date) => {
    return filteredVisits.filter(v => {
      const vDate = new Date(v.scheduled_at);
      return vDate.getDate() === date.getDate() && 
             vDate.getMonth() === date.getMonth() &&
             vDate.getFullYear() === date.getFullYear();
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="calendar-container">
      {/* Top Header */}
      <header className="calendar-header">
        <div className="calendar-controls">
          <div className="month-display">
            <span className="month-name">{monthName}</span>
            <span className="year-display">{yearName}</span>
          </div>
          <div className="nav-buttons">
            <button className="nav-btn" onClick={() => navigateDate(-1)}><ChevronLeft size={20} /></button>
            <button className="nav-btn" onClick={() => navigateDate(1)}><ChevronRight size={20} /></button>
          </div>
          <button className="today-btn" onClick={() => setCurrentDate(new Date())}>Hoje</button>
        </div>

        <div className="calendar-actions">
          <div className="search-wrapper">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Buscar na agenda..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="nav-btn"><Filter size={18} /></button>
          <div className="view-switcher">
            <button className={`view-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Dia</button>
            <button className={`view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Semana</button>
            <button className={`view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Mês</button>
          </div>
          <button className="agendar-btn" onClick={() => setShowNewForm(true)}>
            <Plus size={18} /> Agendar
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="calendar-grid-wrapper glass-panel">
        <div className="calendar-grid-header" style={{ 
          gridTemplateColumns: view === 'month' ? 'repeat(7, 1fr)' : `80px repeat(${displayDays.length}, 1fr)` 
        }}>
          {view !== 'month' && <div className="time-column-header">Hora</div>}
          {view === 'month' ? (
            ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="header-cell">
                <span className="day-name">{d}</span>
              </div>
            ))
          ) : (
            displayDays.map((day, i) => (
              <div key={i} className={`header-cell ${isToday(day) ? 'active' : ''}`}>
                <span className="day-name">{day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                <span className="day-number">{day.getDate()}</span>
              </div>
            ))
          )}
        </div>

        <div className="calendar-grid-content" style={{ 
          gridTemplateColumns: view === 'month' ? 'repeat(7, 1fr)' : `80px repeat(${displayDays.length}, 1fr)` 
        }}>
          {view === 'month' ? (
            displayDays.map((day, i) => {
              const dayVisits = getAppointmentsForDay(day);
              const isOtherMonth = day.getMonth() !== currentDate.getMonth();
              return (
                <div key={i} className={`grid-cell month-cell ${isToday(day) ? 'active' : ''} ${isOtherMonth ? 'other-month' : ''}`} style={{ height: '120px' }}>
                  <span className="month-day-number">{day.getDate()}</span>
                  <div className="month-visit-indicators">
                    {dayVisits.slice(0, 3).map(v => (
                      <div key={v.id} className="visit-dot" style={{ backgroundColor: STATUS_MAP[v.status]?.color || 'var(--accent-primary)' }} />
                    ))}
                    {dayVisits.length > 3 && <span className="more-count">+{dayVisits.length - 3}</span>}
                  </div>
                  <div className="click-layer" onClick={() => { setCurrentDate(day); setView('day'); }} />
                </div>
              );
            })
          ) : (
            HOURS.map(hour => (
              <div key={`row-${hour}`} style={{ display: 'contents' }}>
                <div key={`label-${hour}`} className="time-slot-label">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {displayDays.map((day, i) => {
                  const cellAppointments = getAppointmentsForCell(day, hour);
                  return (
                    <div key={`${i}-${hour}`} className="grid-cell">
                      {cellAppointments.map(visit => {
                        const st = STATUS_MAP[visit.status] || STATUS_MAP.scheduled;
                        return (
                          <div 
                            key={visit.id} 
                            className="appointment-card"
                            onClick={(e) => { e.stopPropagation(); setSelectedVisit(visit); }}
                            style={{ 
                              backgroundColor: `${st.color}22`, 
                              borderColor: st.color,
                              color: st.color
                            }}
                          >
                            <div className="appointment-time">
                              {new Date(visit.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="appointment-name">{visit.lead_name}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.1)', zIndex: 50, borderRadius: 'var(--radius-lg)' }}>
          <Loader2 className="animate-spin" size={36} />
        </div>
      )}

      {/* Modals */}
      {mounted && (showNewForm || selectedVisit) && createPortal(
        <div style={{ 
          position: 'fixed', 
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 99999, 
          backdropFilter: 'blur(8px)',
          padding: '1rem'
        }} onClick={() => { setShowNewForm(false); setSelectedVisit(null); }}>
          
          <div 
            className="glass-panel animate-in" 
            style={{ 
              padding: '2rem', 
              width: '100%', 
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {showNewForm ? (
              <>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Agendar Nova Visita</h3>
                <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nome do Lead (Buscar ou Criar) *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="visit-lead-search" 
                        value={leadSearch}
                        onChange={e => handleLeadSearch(e.target.value)}
                        placeholder="Pesquisar por nome ou telefone..." 
                        style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                        required
                      />
                      {leadSuggestions.length > 0 && (
                        <div style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          right: 0, 
                          background: 'var(--bg-secondary)', 
                          border: '1px solid var(--glass-border)', 
                          borderRadius: '8px', 
                          zIndex: 10,
                          marginTop: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}>
                          {leadSuggestions.map(lead => (
                            <button 
                              key={lead.id} 
                              type="button" 
                              onClick={() => selectLead(lead)}
                              style={{ 
                                width: '100%', 
                                padding: '0.75rem 1rem', 
                                textAlign: 'left', 
                                borderBottom: '1px solid var(--glass-border)',
                                color: '#fff',
                                display: 'flex',
                                flexDirection: 'column'
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{lead.name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', gridColumn: '1 / -1' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Telefone</label>
                      <input 
                        style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }} 
                        value={form.lead_phone} 
                        onChange={e => setFormField('lead_phone', maskPhone(e.target.value))} 
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Data *</label>
                      <input 
                        type="date" 
                        style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', colorScheme: 'dark' }} 
                        value={scheduledDate} 
                        onChange={e => setScheduledDate(e.target.value)} 
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', gridColumn: '1 / -1' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Horário *</label>
                      <select 
                        style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }} 
                        value={scheduledTime} 
                        onChange={e => setScheduledTime(e.target.value)} 
                        required
                      >
                        <option value="">Selecione...</option>
                        {Array.from({ length: 25 }, (_, i) => {
                          const h = Math.floor(i / 2) + 8;
                          const m = i % 2 === 0 ? '00' : '30';
                          const time = `${String(h).padStart(2, '0')}:${m}`;
                          return <option key={time} value={time}>{time}</option>;
                        })}
                      </select>
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Observações</label>
                    <textarea 
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', minHeight: '80px', resize: 'vertical' }} 
                      value={form.notes} 
                      onChange={e => setFormField('notes', e.target.value)}
                      placeholder="Alguma observação importante para a visita?"
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => { setShowNewForm(false); setLeadSearch(''); setLeadSuggestions([]); }} 
                      style={{ color: 'var(--text-secondary)', fontWeight: 500 }}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="agendar-btn" disabled={saving} style={{ padding: '0.75rem 2rem' }}>
                      {saving ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Agendamento'}
                    </button>
                  </div>
                </form>
              </>
            ) : selectedVisit ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                      {selectedVisit.lead_name}
                    </h3>
                    {!isEditing && (
                      <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={14} /> {new Date(selectedVisit.scheduled_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setSelectedVisit(null); setIsEditing(false); }} style={{ color: 'var(--text-muted)' }}>
                    <XCircle size={24} />
                  </button>
                </div>

                {isEditing ? (
                  <form 
                    id="edit-visit-form"
                    onSubmit={handleUpdate} 
                    style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Data</label>
                        <input 
                          type="date"
                          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', colorScheme: 'dark' }}
                          value={editForm.scheduled_date}
                          onChange={e => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Horário</label>
                        <select 
                          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                          value={editForm.scheduled_time}
                          onChange={e => setEditForm({ ...editForm, scheduled_time: e.target.value })}
                        >
                          {Array.from({ length: 25 }, (_, i) => {
                            const h = Math.floor(i / 2) + 8;
                            const m = i % 2 === 0 ? '00' : '30';
                            const time = `${String(h).padStart(2, '0')}:${m}`;
                            return <option key={time} value={time}>{time}</option>;
                          })}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Telefone</label>
                      <input 
                        style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                        value={editForm.lead_phone}
                        onChange={e => setEditForm({ ...editForm, lead_phone: maskPhone(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Observações</label>
                      <textarea 
                        style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', minHeight: '80px' }}
                        value={editForm.notes}
                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button 
                        type="button" 
                        onClick={() => setIsEditing(false)} 
                        style={{ flex: 1, color: 'var(--text-secondary)' }}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button" 
                        className="agendar-btn" 
                        disabled={saving} 
                        style={{ flex: 2, justifyContent: 'center' }}
                        onClick={() => {
                          setConfirmModal({
                            show: true,
                            title: 'Confirmar Alteração',
                            message: 'Deseja salvar as alterações feitas neste agendamento?',
                            type: 'primary',
                            action: () => {
                              // Chamar handleUpdate manualmente passando um evento de submit simulado ou refatorar
                              const formElement = document.getElementById('edit-visit-form') as HTMLFormElement;
                              if (formElement) formElement.requestSubmit();
                            }
                          });
                        }}
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Alterações'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                       <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                         <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Telefone</label>
                         <div style={{ color: '#fff', fontWeight: 600 }}>{maskPhone(selectedVisit.leads?.phone || selectedVisit.lead_phone || '') || 'Não informado'}</div>
                       </div>
                       
                       <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                         <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Status</label>
                         <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: STATUS_MAP[selectedVisit.status]?.color, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: `${STATUS_MAP[selectedVisit.status]?.color}11`, borderRadius: '20px', border: `1px solid ${STATUS_MAP[selectedVisit.status]?.color}33` }}>
                            {STATUS_MAP[selectedVisit.status]?.label}
                         </div>
                       </div>
    
                       {selectedVisit.notes && (
                         <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                           <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Observações</label>
                           <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>{selectedVisit.notes}</div>
                         </div>
                       )}
                    </div>
    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                       <button 
                        className="agendar-btn" 
                        style={{ flex: 1, justifyContent: 'center' }} 
                        onClick={() => {
                          const dt = new Date(selectedVisit.scheduled_at);
                          setEditForm({
                            scheduled_date: dt.toISOString().split('T')[0],
                            scheduled_time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
                            lead_phone: selectedVisit.lead_phone,
                            notes: selectedVisit.notes || '',
                            status: selectedVisit.status
                          });
                          setIsEditing(true);
                        }}
                       >
                         Editar Visita
                       </button>
                       <button 
                        style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                        onClick={() => {
                          setConfirmModal({
                            show: true,
                            title: 'Excluir Agendamento',
                            message: 'Tem certeza que deseja remover esta visita? Esta ação não pode ser desfeita.',
                            type: 'danger',
                            action: handleDelete
                          });
                        }}
                       >
                         Excluir
                       </button>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {mounted && confirmModal.show && createPortal(
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 999999,
          backdropFilter: 'blur(12px)'
        }} onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
          <div 
            className="glass-panel animate-in" 
            style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              background: confirmModal.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 1.5rem',
              color: confirmModal.type === 'danger' ? '#ef4444' : '#3b82f6',
              border: `1px solid ${confirmModal.type === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`
            }}>
              {confirmModal.type === 'danger' ? <XCircle size={32} /> : <CheckCircle size={32} />}
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '2rem' }}>{confirmModal.message}</p>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.action}
                style={{ 
                  flex: 1, 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  background: confirmModal.type === 'danger' ? '#ef4444' : 'var(--accent-primary)', 
                  color: '#fff', 
                  fontWeight: 600,
                  boxShadow: confirmModal.type === 'danger' ? '0 4px 15px rgba(239, 68, 68, 0.3)' : 'var(--accent-shadow)' 
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
