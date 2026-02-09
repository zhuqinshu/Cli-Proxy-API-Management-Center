import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HeaderInputList } from '@/components/ui/HeaderInputList';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { SecondaryScreenShell } from '@/components/common/SecondaryScreenShell';
import { providersApi } from '@/services/api';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import type { ProviderKeyConfig } from '@/types';
import { buildHeaderObject, headersToEntries } from '@/utils/headers';
import { entriesToModels } from '@/components/ui/modelInputListUtils';
import { excludedModelsToText, parseExcludedModels } from '@/components/providers/utils';
import type { ProviderFormState } from '@/components/providers';
import layoutStyles from './AiProvidersEditLayout.module.scss';

type LocationState = { fromAiProviders?: boolean } | null;

const buildEmptyForm = (): ProviderFormState => ({
  name: '',
  apiKeyEntries: [''],  // Array of API keys
  prefix: '',
  baseUrl: '',
  proxyUrl: '',
  headers: [],
  models: [],
  excludedModels: [],
  modelEntries: [{ name: '', alias: '' }],
  excludedText: '',
});

const parseIndexParam = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export function AiProvidersCodexEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ index?: string }>();

  const { showNotification } = useNotificationStore();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const disableControls = connectionStatus !== 'connected';

  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const updateConfigValue = useConfigStore((state) => state.updateConfigValue);
  const clearCache = useConfigStore((state) => state.clearCache);

  const [configs, setConfigs] = useState<ProviderKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ProviderFormState>(() => buildEmptyForm());

  const hasIndexParam = typeof params.index === 'string';
  const editIndex = useMemo(() => parseIndexParam(params.index), [params.index]);
  const invalidIndexParam = hasIndexParam && editIndex === null;

  const initialData = useMemo(() => {
    if (editIndex === null) return undefined;
    return configs[editIndex];
  }, [configs, editIndex]);

  const invalidIndex = editIndex !== null && !initialData;

  const title =
    editIndex !== null ? t('ai_providers.codex_edit_modal_title') : t('ai_providers.codex_add_modal_title');

  const handleBack = useCallback(() => {
    const state = location.state as LocationState;
    if (state?.fromAiProviders) {
      navigate(-1);
      return;
    }
    navigate('/ai-providers', { replace: true });
  }, [location.state, navigate]);

  const swipeRef = useEdgeSwipeBack({ onBack: handleBack });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchConfig('codex-api-key')
      .then((value) => {
        if (cancelled) return;
        setConfigs(Array.isArray(value) ? (value as ProviderKeyConfig[]) : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '';
        setError(message || t('notification.refresh_failed'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchConfig, t]);

  useEffect(() => {
    if (loading) return;

    if (initialData) {
      setForm({
        name: initialData.name || '',
        apiKeyEntries: initialData.apiKeyEntries || [''],
        prefix: initialData.prefix || '',
        baseUrl: initialData.baseUrl || '',
        proxyUrl: initialData.proxyUrl || '',
        headers: headersToEntries(initialData.headers),
        modelEntries: (initialData.models || []).map((model) => ({
          name: model.name,
          alias: model.alias ?? '',
        })),
        excludedText: excludedModelsToText(initialData.excludedModels),
        models: initialData.models,
        excludedModels: initialData.excludedModels,
      });
      return;
    }
    setForm(buildEmptyForm());
  }, [initialData, loading]);

  const canSave = !disableControls && !saving && !loading && !invalidIndexParam && !invalidIndex;

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    const trimmedName = (form.name ?? '').trim();
    const trimmedBaseUrl = (form.baseUrl ?? '').trim();
    
    if (!trimmedName) {
      showNotification(t('notification.codex_name_required'), 'error');
      return;
    }
    
    if (!trimmedBaseUrl) {
      showNotification(t('notification.codex_base_url_required'), 'error');
      return;
    }
    
    // Validate at least one valid API key
    const validKeys = (form.apiKeyEntries || []).filter(key => key.trim());
    if (validKeys.length === 0) {
      showNotification(t('notification.codex_api_key_required'), 'error');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: ProviderKeyConfig = {
        name: trimmedName,
        prefix: form.prefix?.trim() || undefined,
        baseUrl: trimmedBaseUrl,
        proxyUrl: form.proxyUrl?.trim() || undefined,
        apiKeyEntries: validKeys.map(key => key.trim()),
        headers: buildHeaderObject(form.headers),
        models: entriesToModels(form.modelEntries),
        excludedModels: parseExcludedModels(form.excludedText),
      };

      const nextList =
        editIndex !== null
          ? configs.map((item, idx) => (idx === editIndex ? payload : item))
          : [...configs, payload];

      await providersApi.saveCodexConfigs(nextList);
      updateConfigValue('codex-api-key', nextList);
      clearCache('codex-api-key');
      showNotification(
        editIndex !== null ? t('notification.codex_config_updated') : t('notification.codex_config_added'),
        'success'
      );
      handleBack();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(message);
      showNotification(`${t('notification.update_failed')}: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    clearCache,
    configs,
    editIndex,
    form,
    handleBack,
    showNotification,
    t,
    updateConfigValue,
  ]);

  const renderKeyEntries = (entries: string[]) => {
    const list = entries.length ? entries : [''];

    const updateEntry = (idx: number, value: string) => {
      const next = list.map((entry, i) => (i === idx ? value : entry));
      setForm((prev) => ({ ...prev, apiKeyEntries: next }));
    };

    const removeEntry = (idx: number) => {
      const next = list.filter((_, i) => i !== idx);
      setForm((prev) => ({
        ...prev,
        apiKeyEntries: next.length ? next : [''],
      }));
    };

    const addEntry = () => {
      setForm((prev) => ({ ...prev, apiKeyEntries: [...list, ''] }));
    };

    return (
      <div className="stack">
        {list.map((entry, index) => (
          <div key={index} className="item-row">
            <div className="item-meta">
              <Input
                label={`${t('common.api_key')} #${index + 1}`}
                value={entry}
                onChange={(e) => updateEntry(index, e.target.value)}
                disabled={saving || disableControls}
              />
            </div>
            <div className="item-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(index)}
                disabled={saving || disableControls || list.length <= 1}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={addEntry}
          disabled={saving || disableControls}
        >
          {t('ai_providers.codex_keys_add_btn')}
        </Button>
      </div>
    );
  };


  return (
    <SecondaryScreenShell
      ref={swipeRef}
      contentClassName={layoutStyles.content}
      title={title}
      onBack={handleBack}
      backLabel={t('common.back')}
      backAriaLabel={t('common.back')}
      rightAction={
        <Button size="sm" onClick={handleSave} loading={saving} disabled={!canSave}>
          {t('common.save')}
        </Button>
      }
      isLoading={loading}
      loadingLabel={t('common.loading')}
    >
      <Card>
        {error && <div className="error-box">{error}</div>}
        {invalidIndexParam || invalidIndex ? (
          <div className="hint">Invalid provider index.</div>
        ) : (
          <>
            <Input
              label={t('ai_providers.codex_add_modal_name_label')}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={disableControls || saving}
              hint={t('ai_providers.name_hint')}
            />
            <Input
              label={t('ai_providers.prefix_label')}
              placeholder={t('ai_providers.prefix_placeholder')}
              value={form.prefix ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, prefix: e.target.value }))}
              hint={t('ai_providers.prefix_hint')}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.codex_add_modal_url_label')}
              value={form.baseUrl ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              disabled={disableControls || saving}
            />
            <Input
              label={t('ai_providers.codex_add_modal_proxy_label')}
              value={form.proxyUrl ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, proxyUrl: e.target.value }))}
              disabled={disableControls || saving}
              hint={t('ai_providers.proxy_url_shared_hint')}
            />
            
            {/* API Keys Section */}
            <div className="form-group">
              <label>{t('ai_providers.codex_add_modal_keys_label')}</label>
              <div className="hint">{t('ai_providers.multi_keys_hint')}</div>
              {renderKeyEntries(form.apiKeyEntries || [''])}
            </div>
            <HeaderInputList
              entries={form.headers}
              onChange={(entries) => setForm((prev) => ({ ...prev, headers: entries }))}
              addLabel={t('common.custom_headers_add')}
              keyPlaceholder={t('common.custom_headers_key_placeholder')}
              valuePlaceholder={t('common.custom_headers_value_placeholder')}
              disabled={disableControls || saving}
            />
            <div className="form-group">
              <label>{t('ai_providers.excluded_models_label')}</label>
              <textarea
                className="input"
                placeholder={t('ai_providers.excluded_models_placeholder')}
                value={form.excludedText}
                onChange={(e) => setForm((prev) => ({ ...prev, excludedText: e.target.value }))}
                rows={4}
                disabled={disableControls || saving}
              />
              <div className="hint">{t('ai_providers.excluded_models_hint')}</div>
            </div>
          </>
        )}
      </Card>
    </SecondaryScreenShell>
  );
}
