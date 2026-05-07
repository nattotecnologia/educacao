'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Search, Edit2, Trash2, Tag, Sparkles, Percent, DollarSign, Calendar, BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Promotion {
  id: string;
  name: string;
  description: string;
  discount_percentage: number | null;
  discount_value: number | null;
  is_active: boolean;
  valid_until: string | null;
  course_id: string | null;
  courses?: { name: string } | null;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage', // 'percentage' or 'value'
    discount_percentage: '',
    discount_value: '',
    is_active: true,
    valid_until: '',
    course_id: '' // empty string for general (null)
  });

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/promotions?active=false', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPromotions(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
    const fetchCourses = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('courses').select('id, name');
      setCourses(data || []);
    };
    fetchCourses();
  }, [fetchPromotions]);

  const handleGenerateAIDescription = () => {
    if (!formData.name) {
      alert('Por favor, digite o nome da promoção antes de gerar com IA.');
      return;
    }
    setGeneratingDescription(true);
    setTimeout(() => {
      const valueFormatted = formData.discount_type === 'percentage'
        ? `${formData.discount_percentage || '10'}%`
        : `R$ ${formData.discount_value || '50'}`;
      
      const courseName = formData.course_id
        ? courses.find(c => c.id === formData.course_id)?.name
        : null;

      const templates = [
        `✨ Oferta Especial: Garanta sua matrícula hoje mesmo e ganhe ${valueFormatted} de desconto${courseName ? ` exclusivo no curso ${courseName}` : ' para qualquer curso da nossa grade'}! Vagas limitadas, aproveite!`,
        `🚀 Invista na sua carreira agora! Utilize o cupom e receba um desconto de ${valueFormatted}${courseName ? ` aplicado na sua matrícula de ${courseName}` : ' elegível para toda a nossa plataforma'}. Não perca essa chance!`,
        `🎓 Condição exclusiva de incentivo acadêmico: Desconto de ${valueFormatted}${courseName ? ` para novas matrículas do curso ${courseName}` : ' válido para qualquer curso disponível'}. Campanha ativa por tempo limitado!`
      ];

      const selected = templates[Math.floor(Math.random() * templates.length)];
      setFormData(prev => ({ ...prev, description: selected }));
      setGeneratingDescription(false);
    }, 700);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        name: formData.name,
        description: formData.description,
        discount_percentage: formData.discount_type === 'percentage' && formData.discount_percentage ? Number(formData.discount_percentage) : null,
        discount_value: formData.discount_type === 'value' && formData.discount_value ? Number(formData.discount_value) : null,
        is_active: formData.is_active,
        valid_until: formData.valid_until || null,
        course_id: formData.course_id || null
      };

      const url = editingId ? `/api/promotions/${editingId}` : '/api/promotions';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Erro ao salvar promoção');
      
      setIsModalOpen(false);
      fetchPromotions();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar promoção');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta promoção?')) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/promotions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      fetchPromotions();
    } catch (error) {
      console.error(error);
    }
  };

  const openEdit = (promo: Promotion) => {
    setFormData({
      name: promo.name,
      description: promo.description || '',
      discount_type: promo.discount_percentage !== null ? 'percentage' : 'value',
      discount_percentage: promo.discount_percentage?.toString() || '',
      discount_value: promo.discount_value?.toString() || '',
      is_active: promo.is_active,
      valid_until: promo.valid_until ? promo.valid_until.split('T')[0] : '',
      course_id: promo.course_id || ''
    });
    setEditingId(promo.id);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_percentage: '',
      discount_value: '',
      is_active: true,
      valid_until: '',
      course_id: ''
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const filtered = search
    ? promotions.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : promotions;

  const s = {
    page: { display: 'flex', flexDirection: 'column' as const, gap: '2rem', maxWidth: '1200px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '1rem' },
    searchContainer: {
      display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.6rem 1rem',
      width: '100%', maxWidth: '400px', transition: 'all 0.2s'
    },
    searchInput: {
      background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none',
      width: '100%', fontSize: '0.9rem'
    },
    btn: {
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)', color: '#fff',
      padding: '0.75rem 1.5rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 700,
      boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s', cursor: 'pointer', border: 'none'
    },
    badge: (color: string) => ({
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem',
      fontWeight: 700, padding: '0.3rem 0.7rem', borderRadius: '999px',
      background: `${color}1a`, color, border: `1px solid ${color}33`
    }),
    tableContainer: {
      background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
      borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 30px rgba(0,0,0,0.15)'
    },
    th: {
      padding: '1rem 1.25rem', textAlign: 'left' as const, fontSize: '0.72rem',
      fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const,
      letterSpacing: '0.05em', borderBottom: '1px solid var(--glass-border)'
    },
    tr: (isLast: boolean) => ({
      borderBottom: isLast ? 'none' : '1px solid var(--glass-border)',
      transition: 'background 0.15s ease'
    }),
    td: { padding: '1.125rem 1.25rem', fontSize: '0.85rem' },
    modalOverlay: {
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out'
    },
    modalContent: {
      background: 'var(--bg-primary)', padding: '2rem', borderRadius: '16px',
      width: '100%', maxWidth: '550px', border: '1px solid var(--glass-border)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative' as const,
      display: 'flex', flexDirection: 'column' as const, gap: '1.5rem'
    },
    label: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' },
    input: {
      width: '100%', 
      paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '1rem', paddingRight: '1rem',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)',
      fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s'
    },
    aiBtn: {
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff',
      padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
      cursor: 'pointer', border: 'none', transition: 'all 0.2s', marginTop: '0.5rem'
    }
  };

  return (
    <div style={s.page} className="animate-in">
      <div style={s.header}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Promoções e Descontos</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Crie campanhas dinâmicas, defina cupons e conecte com o agente de IA para engajar leads.
          </p>
        </div>
        <button 
          style={s.btn} 
          onClick={openNew}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.2)'; }}
        >
          <Plus size={18} /> Nova Promoção
        </button>
      </div>

      <div style={s.searchContainer}>
        <Search size={18} style={{ color: 'var(--text-muted)' }} />
        <input 
          style={s.searchInput} 
          placeholder="Buscar promoção por nome..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
          <Tag size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nenhuma promoção cadastrada</h3>
          <p style={{ marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>Sua instituição ainda não possui cupons ou descontos configurados para o Agente Comercial usar.</p>
        </div>
      ) : (
        <div style={s.tableContainer}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome & Descrição', 'Escopo de Aplicação', 'Desconto', 'Validade', 'Status', 'Ações'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const isLast = i === filtered.length - 1;
                return (
                  <tr 
                    key={p.id} 
                    style={s.tr(isLast)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.01)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={s.td}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', maxWidth: '400px', lineBreak: 'anywhere' }}>{p.description}</div>}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: p.courses ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                        <BookOpen size={14} />
                        {p.courses?.name ? p.courses.name : 'Geral (Todos os Cursos)'}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {p.discount_percentage ? <Percent size={14} style={{ color: 'var(--accent-success)' }} /> : <DollarSign size={14} style={{ color: 'var(--accent-success)' }} />}
                        {p.discount_percentage ? `${p.discount_percentage}%` : `R$ ${p.discount_value}`}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Calendar size={14} />
                        {p.valid_until ? new Date(p.valid_until).toLocaleDateString('pt-BR') : 'Uso por tempo ilimitado'}
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(p.is_active ? '#10b981' : '#ef4444')}>
                        {p.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => openEdit(p)} 
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)} 
                          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} className="animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{editingId ? '✏️ Editar' : '✨ Nova'} Promoção</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Configuração de Desconto</span>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={s.label}>Nome da Campanha / Cupom *</label>
                <input 
                  required 
                  placeholder="Ex: CUPOMDEVOLTA, Desconto de Inverno..." 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  style={s.input} 
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={s.label}>Descrição Comercial</label>
                  <button 
                    type="button" 
                    onClick={handleGenerateAIDescription} 
                    style={s.aiBtn}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                  >
                    {generatingDescription ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                    {generatingDescription ? 'Escrevendo...' : 'Gerar com IA'}
                  </button>
                </div>
                <textarea 
                  placeholder="Clique em 'Gerar com IA' para que a inteligência comercial monte a melhor copy de marketing..." 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  style={{ ...s.input, height: '90px', resize: 'none' as const, marginTop: '0.35rem' }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={s.label}>Tipo de Desconto</label>
                  <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '3px', border: '1px solid var(--glass-border)' }}>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, discount_type: 'percentage' })}
                      style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, background: formData.discount_type === 'percentage' ? 'var(--accent-primary)' : 'transparent', color: formData.discount_type === 'percentage' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}
                    >
                      Porcentagem (%)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, discount_type: 'value' })}
                      style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, background: formData.discount_type === 'value' ? 'var(--accent-primary)' : 'transparent', color: formData.discount_type === 'value' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}
                    >
                      Fixo (R$)
                    </button>
                  </div>
                </div>

                <div>
                  <label style={s.label}>Valor do Desconto *</label>
                  {formData.discount_type === 'percentage' ? (
                    <div style={{ position: 'relative' }}>
                      <input 
                        key="promo-pct-input"
                        type="number" 
                        required 
                        min="1" 
                        max="100" 
                        placeholder="Ex: 15" 
                        value={formData.discount_percentage} 
                        onChange={e => setFormData({ ...formData, discount_percentage: e.target.value })} 
                        style={{ ...s.input, paddingRight: '2.5rem' }} 
                      />
                      <Percent size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input 
                        key="promo-val-input"
                        type="number" 
                        required 
                        min="1" 
                        placeholder="Ex: 150" 
                        value={formData.discount_value} 
                        onChange={e => setFormData({ ...formData, discount_value: e.target.value })} 
                        style={{ ...s.input, paddingLeft: '2.5rem' }} 
                      />
                      <DollarSign size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={s.label}>Escopo de Aplicação</label>
                  <select 
                    value={formData.course_id} 
                    onChange={e => setFormData({ ...formData, course_id: e.target.value })} 
                    style={{ ...s.input, cursor: 'pointer' }}
                  >
                    <option value="">Geral (Todos os Cursos)</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={s.label}>Válido até</label>
                  <input 
                    type="date" 
                    value={formData.valid_until} 
                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })} 
                    style={s.input} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '0.8rem 1rem', borderRadius: '10px' }}>
                <input 
                  type="checkbox" 
                  id="chk-active"
                  checked={formData.is_active} 
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="chk-active" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Disponibilizar esta promoção para o Agente Comercial usar no WhatsApp</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ ...s.btn, padding: '0.75rem 1.5rem' }}
                >
                  Salvar Campanha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
