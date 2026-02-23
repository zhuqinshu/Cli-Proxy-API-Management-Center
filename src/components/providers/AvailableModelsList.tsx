import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvailableModelInfo } from '@/types';
import styles from '@/pages/AiProvidersPage.module.scss';

interface AvailableModelsListProps {
  models: AvailableModelInfo[];
}

export function AvailableModelsList({ models }: AvailableModelsListProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!models.length) return null;

  return (
    <div className={styles.availableModelsSection}>
      <button
        type="button"
        className={styles.availableModelsToggle}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className={styles.availableModelsLabel}>
          {t('ai_providers.available_models_count', { count: models.length })}
        </span>
        <span className={`${styles.availableModelsChevron} ${expanded ? styles.availableModelsChevronOpen : ''}`}>
          ▸
        </span>
      </button>
      {expanded && (
        <div className={styles.availableModelsTagList}>
          {models.map((model) => (
            <span key={model.id} className={styles.availableModelTag}>
              <span className={styles.modelName}>{model.id}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
