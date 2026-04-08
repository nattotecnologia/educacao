import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'danger',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={!isLoading ? onCancel : undefined}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={`${styles.iconWrapper} ${styles[type]}`}>
            <AlertTriangle size={24} />
          </div>
          <button className={styles.closeBtn} onClick={onCancel} disabled={isLoading}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.body}>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.cancelBtn} 
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          
          <button 
            className={`${styles.confirmBtn} ${styles[type]}`} 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={styles.loadingSpinner}></span>
            ) : (
              <>
                <Check size={16} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
