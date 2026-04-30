'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Loader2, X, Sparkles, Rocket } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  category?: string;
}

interface AutocompleteProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function Autocomplete({ 
  options, 
  value, 
  onChange, 
  placeholder = "Pesquisar...", 
  isLoading = false,
  disabled = false
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase()) || 
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(options.map(o => o.category).filter(Boolean)));

  const styles = {
    wrapper: {
      position: 'relative' as const,
      width: '100%',
      zIndex: isOpen ? 100 : 1,
    },
    trigger: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      background: 'rgba(0, 0, 0, 0.25)',
      border: '1px solid var(--glass-border)',
      borderRadius: '12px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
      width: '100%',
      textAlign: 'left' as const,
    },
    valueText: {
      flex: 1,
      fontSize: '0.875rem',
      fontWeight: 500,
      color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    dropdown: {
      position: 'absolute' as const,
      top: 'calc(100% + 8px)',
      left: 0,
      right: 0,
      background: '#1a1a1a',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      padding: '0.75rem',
      zIndex: 1000,
      animation: 'dropdownIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    searchWrapper: {
      position: 'relative' as const,
      marginBottom: '1rem',
    },
    searchInput: {
      width: '100%',
      padding: '0.75rem 1rem 0.75rem 2.5rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#ffffff',
      fontSize: '0.875rem',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    optionsList: {
      maxHeight: '320px',
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.35rem',
      paddingRight: '4px',
    },
    categoryHeader: {
      padding: '0.75rem 0.5rem 0.5rem 0.5rem',
      fontSize: '0.65rem',
      fontWeight: 800,
      color: 'var(--accent-primary)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    option: (isActive: boolean) => ({
      width: '100%',
      padding: '0.75rem 1rem',
      borderRadius: '12px',
      textAlign: 'left' as const,
      background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.25rem',
    }),
    optionName: (isActive: boolean) => ({
      fontSize: '0.875rem',
      fontWeight: 600,
      color: isActive ? '#60a5fa' : '#f8fafc',
    }),
    optionId: {
      fontSize: '0.75rem',
      color: '#94a3b8',
      opacity: 0.8,
    }
  };

  return (
    <div style={styles.wrapper} ref={wrapperRef}>
      <button 
        type="button"
        style={styles.trigger}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = 'var(--glass-border)';
        }}
      >
        <div style={styles.valueText}>
          {selectedOption ? selectedOption.name : value || placeholder}
        </div>
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown 
            size={16} 
            style={{ 
              color: 'var(--text-muted)', 
              transition: 'transform 0.3s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0)'
            }} 
          />
        )}
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.searchWrapper}>
            <Search 
              size={14} 
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
            />
            <input
              autoFocus
              style={styles.searchInput}
              placeholder="Digite para filtrar modelos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
            />
            {search && (
              <X 
                size={14} 
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} 
              />
            )}
          </div>

          <div style={styles.optionsList} className="custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Nenhum modelo encontrado para "{search}"
              </div>
            ) : categories.length > 0 ? (
              categories.map(cat => {
                const catOptions = filteredOptions.filter(o => o.category === cat);
                if (catOptions.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: '0.5rem' }}>
                    <div style={styles.categoryHeader}>
                      {cat === 'free' ? <Sparkles size={12} /> : <Rocket size={12} />}
                      {cat === 'free' ? 'Modelos Gratuitos' : 'Modelos Premium'}
                    </div>
                    {catOptions.map(option => {
                      const isActive = value === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          style={styles.option(isActive)}
                          onClick={() => {
                            onChange(option.id);
                            setIsOpen(false);
                            setSearch('');
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={styles.optionName(isActive)}>{option.name}</span>
                          <span style={styles.optionId}>{option.id}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              filteredOptions.map(option => {
                const isActive = value === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    style={styles.option(isActive)}
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={styles.optionName(isActive)}>{option.name}</span>
                    <span style={styles.optionId}>{option.id}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}
