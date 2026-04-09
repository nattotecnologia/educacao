'use client';

import { CommunicationStyle } from '@/services';

interface StyleOption {
  value: CommunicationStyle;
  label: string;
  emoji: string;
  description: string;
  badge: string;
  color: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    value: 'whatsapp',
    label: 'WhatsApp Nativo',
    emoji: '📱',
    description: 'Curto, com emojis, tom de conversa real',
    badge: 'Recomendado',
    color: '#25d366',
  },
  {
    value: 'casual',
    label: 'Casual',
    emoji: '😊',
    description: 'Informal e amigável, sem ser excessivo',
    badge: '',
    color: '#6366f1',
  },
  {
    value: 'formal',
    label: 'Formal',
    emoji: '👔',
    description: 'Profissional, sem gírias ou emojis',
    badge: '',
    color: '#64748b',
  },
  {
    value: 'default',
    label: 'Padrão da IA',
    emoji: '🤖',
    description: 'Sem reforço de estilo — usa só o system prompt',
    badge: '',
    color: '#475569',
  },
];

interface CommunicationStylePickerProps {
  value: CommunicationStyle;
  onChange: (v: CommunicationStyle) => void;
}

export function CommunicationStylePicker({ value, onChange }: CommunicationStylePickerProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {STYLE_OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '1rem',
              borderRadius: '10px',
              textAlign: 'left',
              cursor: 'pointer',
              border: `1px solid ${isSelected ? opt.color : 'var(--glass-border)'}`,
              background: isSelected
                ? `${opt.color}18`
                : 'rgba(0,0,0,0.15)',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {opt.badge && (
              <span style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem',
                borderRadius: '4px', background: opt.color, color: '#fff',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {opt.badge}
              </span>
            )}
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{opt.emoji}</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              {opt.label}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {opt.description}
            </div>
            {isSelected && (
              <div style={{
                position: 'absolute', bottom: '0.6rem', right: '0.6rem',
                width: 8, height: 8, borderRadius: '50%', background: opt.color,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
