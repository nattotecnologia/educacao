'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  X, 
  BookOpen, 
  Users, 
  Calendar, 
  MapPin, 
  GraduationCap, 
  Monitor 
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Course {
  id: string;
  name: string;
  modality: string;
}

function NewClassForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get('course_id') || '';
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    course_id: initialCourseId,
    name: '',
    teacher_name: '',
    schedule: '',
    start_date: '',
    end_date: '',
    total_slots: '30',
    meeting_url: '',
    status: 'open'
  });

  // Atualiza o course_id se ele mudar na URL (raro, mas bom ter)
  useEffect(() => {
    if (initialCourseId) {
      setForm(p => ({ ...p, course_id: initialCourseId }));
    }
  }, [initialCourseId]);

  const fetchCourses = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/courses', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCourses(data);
    } catch (err: any) {
      setError('Erro ao carregar cursos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.course_id || !form.name) {
      setError('Curso e Nome da Turma são obrigatórios.');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ 
          ...form, 
          total_slots: parseInt(form.total_slots) 
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      router.push('/dashboard/classes');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar turma.');
      setSaving(false);
    }
  };

  const inp = {
    width: '100%',
    padding: '0.8rem 1rem',
    background: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s ease',
  };

  const lbl = {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '0.5rem',
    display: 'block'
  };

  const selectedCourse = courses.find(c => c.id === form.course_id);

  return (
    <div className="animate-in" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <button 
        onClick={() => router.back()} 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}
      >
        <ArrowLeft size={16} /> Voltar para Turmas
      </button>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Nova Turma</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Cadastre uma nova turma vinculada a um curso.</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Selecione o Curso *</label>
            <select 
              style={inp} 
              value={form.course_id} 
              onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}
              disabled={loading}
            >
              <option value="">Selecione um curso...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.modality})</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Nome da Turma *</label>
            <input 
              style={inp} 
              placeholder="Ex: Turma A — Manhã 2024"
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
            />
          </div>

          <div>
            <label style={lbl}>Professor Responsável</label>
            <input 
              style={inp} 
              placeholder="Nome do professor"
              value={form.teacher_name} 
              onChange={e => setForm(p => ({ ...p, teacher_name: e.target.value }))} 
            />
          </div>

          <div>
            <label style={lbl}>Horário / Frequência</label>
            <input 
              style={inp} 
              placeholder="Ex: Seg/Qua/Sex - 19h às 21h"
              value={form.schedule} 
              onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))} 
            />
          </div>

          <div>
            <label style={lbl}>Data de Início</label>
            <input 
              type="date" 
              style={inp} 
              value={form.start_date} 
              onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} 
            />
          </div>

          <div>
            <label style={lbl}>Previsão de Término</label>
            <input 
              type="date" 
              style={inp} 
              value={form.end_date} 
              onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} 
            />
          </div>

          <div>
            <label style={lbl}>Total de Vagas</label>
            <input 
              type="number" 
              min="1" 
              style={inp} 
              value={form.total_slots} 
              onChange={e => setForm(p => ({ ...p, total_slots: e.target.value }))} 
            />
          </div>

          {selectedCourse && (selectedCourse.modality === 'online' || selectedCourse.modality === 'hybrid') && (
            <div>
              <label style={lbl}>Link da Aula / Meeting</label>
              <input 
                type="url" 
                style={inp} 
                placeholder="https://meet.google.com/..."
                value={form.meeting_url} 
                onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))} 
              />
            </div>
          )}

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
            <button 
              type="button" 
              onClick={() => router.back()} 
              style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="custom-button"
              style={{ padding: '0.75rem 2rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700 }}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Criar Turma</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewClassPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={48} style={{ color: 'var(--accent-primary)' }} /></div>}>
      <NewClassForm />
    </Suspense>
  );
}
