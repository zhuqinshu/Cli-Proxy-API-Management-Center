import type { AmpcodeConfig, AmpcodeModelMapping, ApiKeyEntry, ProviderKeyConfig } from '@/types';
import { buildCandidateUsageSourceIds, type KeyStatBucket, type KeyStats } from '@/utils/usage';
import type { AmpcodeFormState, ModelEntry } from './types';

export const DISABLE_ALL_MODELS_RULE = '*';

export const hasDisableAllModelsRule = (models?: string[]) =>
  Array.isArray(models) &&
  models.some((model) => String(model ?? '').trim() === DISABLE_ALL_MODELS_RULE);

export const stripDisableAllModelsRule = (models?: string[]) =>
  Array.isArray(models)
    ? models.filter((model) => String(model ?? '').trim() !== DISABLE_ALL_MODELS_RULE)
    : [];

export const withDisableAllModelsRule = (models?: string[]) => {
  const base = stripDisableAllModelsRule(models);
  return [...base, DISABLE_ALL_MODELS_RULE];
};

export const withoutDisableAllModelsRule = (models?: string[]) => {
  const base = stripDisableAllModelsRule(models);
  return base;
};

export const parseExcludedModels = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const excludedModelsToText = (models?: string[]) =>
  Array.isArray(models) ? models.join('\n') : '';

export const normalizeOpenAIBaseUrl = (baseUrl: string): string => {
  let trimmed = String(baseUrl || '').trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/\/?v0\/management\/?$/i, '');
  trimmed = trimmed.replace(/\/+$/g, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed;
};

export const buildOpenAIModelsEndpoint = (baseUrl: string): string => {
  const trimmed = normalizeOpenAIBaseUrl(baseUrl);
  if (!trimmed) return '';
  return `${trimmed}/models`;
};

export const buildOpenAIChatCompletionsEndpoint = (baseUrl: string): string => {
  const trimmed = normalizeOpenAIBaseUrl(baseUrl);
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
};

const normalizeApiKeyValue = (value: unknown): string => String(value ?? '').trim();

export const getPrimaryApiKey = (
  config?: Pick<ProviderKeyConfig, 'apiKey' | 'apiKeyEntries'> | null
): string => {
  const fromLegacy = normalizeApiKeyValue(config?.apiKey);
  if (fromLegacy) {
    return fromLegacy;
  }

  const fromEntries = (config?.apiKeyEntries ?? [])
    .map((entry) => normalizeApiKeyValue(entry))
    .find(Boolean);
  return fromEntries ?? '';
};

export const getProviderApiKeys = (
  config?: Pick<ProviderKeyConfig, 'apiKey' | 'apiKeyEntries'> | null
): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();

  const add = (value: unknown) => {
    const trimmed = normalizeApiKeyValue(value);
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    keys.push(trimmed);
  };

  add(config?.apiKey);

  const entries = Array.isArray(config?.apiKeyEntries) ? config.apiKeyEntries : [];
  entries.forEach((entry) => {
    if (typeof entry === 'string') {
      add(entry);
      return;
    }
    if (entry && typeof entry === 'object' && 'apiKey' in entry) {
      add((entry as { apiKey?: unknown }).apiKey);
      return;
    }
    if (entry && typeof entry === 'object' && 'api-key' in entry) {
      add((entry as { 'api-key'?: unknown })['api-key']);
    }
  });

  return keys;
};

export const buildProviderUsageSourceIds = (apiKeys: string[], prefix?: string): string[] => {
  const sourceIds = new Set<string>();

  buildCandidateUsageSourceIds({ prefix }).forEach((id) => sourceIds.add(id));
  apiKeys.forEach((apiKey) => {
    buildCandidateUsageSourceIds({ apiKey, prefix }).forEach((id) => sourceIds.add(id));
  });

  return Array.from(sourceIds);
};

export const getProviderConfigIdentifier = (
  config?: Pick<ProviderKeyConfig, 'name' | 'prefix' | 'baseUrl' | 'apiKey' | 'apiKeyEntries'> | null,
  fallback = 'unknown-provider'
): string => {
  const name = normalizeApiKeyValue(config?.name);
  if (name) {
    return name;
  }

  const apiKey = getPrimaryApiKey(config);
  if (apiKey) {
    return apiKey;
  }

  const prefix = normalizeApiKeyValue(config?.prefix);
  if (prefix) {
    return prefix;
  }

  const baseUrl = normalizeApiKeyValue(config?.baseUrl);
  return baseUrl || fallback;
};

// 根据 source (apiKey) 获取统计数据 - 与旧版逻辑一致
export const getStatsBySource = (
  apiKey: string,
  keyStats: KeyStats,
  prefix?: string
): KeyStatBucket => {
  const bySource = keyStats.bySource ?? {};
  const candidates = buildCandidateUsageSourceIds({ apiKey, prefix });
  if (!candidates.length) {
    return { success: 0, failure: 0 };
  }

  let success = 0;
  let failure = 0;
  candidates.forEach((candidate) => {
    const stats = bySource[candidate];
    if (!stats) return;
    success += stats.success;
    failure += stats.failure;
  });

  return { success, failure };
};

export const getStatsByProviderApiKeys = (
  apiKeys: string[],
  keyStats: KeyStats,
  prefix?: string
): KeyStatBucket => {
  const bySource = keyStats.bySource ?? {};
  const sourceIds = buildProviderUsageSourceIds(apiKeys, prefix);

  if (!sourceIds.length) {
    return { success: 0, failure: 0 };
  }

  let success = 0;
  let failure = 0;
  sourceIds.forEach((id) => {
    const stats = bySource[id];
    if (!stats) return;
    success += stats.success;
    failure += stats.failure;
  });

  return { success, failure };
};

// 对于 OpenAI 提供商，汇总所有 apiKeyEntries 的统计 - 与旧版逻辑一致
export const getOpenAIProviderStats = (
  apiKeyEntries: ApiKeyEntry[] | undefined,
  keyStats: KeyStats,
  providerPrefix?: string
): KeyStatBucket => {
  const bySource = keyStats.bySource ?? {};

  const sourceIds = new Set<string>();
  buildCandidateUsageSourceIds({ prefix: providerPrefix }).forEach((id) => sourceIds.add(id));
  (apiKeyEntries || []).forEach((entry) => {
    buildCandidateUsageSourceIds({ apiKey: entry?.apiKey }).forEach((id) => sourceIds.add(id));
  });

  let success = 0;
  let failure = 0;
  sourceIds.forEach((id) => {
    const stats = bySource[id];
    if (!stats) return;
    success += stats.success;
    failure += stats.failure;
  });

  return { success, failure };
};

export const buildApiKeyEntry = (input?: Partial<ApiKeyEntry>): ApiKeyEntry => ({
  apiKey: input?.apiKey ?? '',
  proxyUrl: input?.proxyUrl ?? '',
  headers: input?.headers ?? {},
});

export const ampcodeMappingsToEntries = (mappings?: AmpcodeModelMapping[]): ModelEntry[] => {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return [{ name: '', alias: '' }];
  }
  return mappings.map((mapping) => ({
    name: mapping.from ?? '',
    alias: mapping.to ?? '',
  }));
};

export const entriesToAmpcodeMappings = (entries: ModelEntry[]): AmpcodeModelMapping[] => {
  const seen = new Set<string>();
  const mappings: AmpcodeModelMapping[] = [];

  entries.forEach((entry) => {
    const from = entry.name.trim();
    const to = entry.alias.trim();
    if (!from || !to) return;
    const key = from.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    mappings.push({ from, to });
  });

  return mappings;
};

export const buildAmpcodeFormState = (ampcode?: AmpcodeConfig | null): AmpcodeFormState => ({
  upstreamUrl: ampcode?.upstreamUrl ?? '',
  upstreamApiKey: '',
  forceModelMappings: ampcode?.forceModelMappings ?? false,
  mappingEntries: ampcodeMappingsToEntries(ampcode?.modelMappings),
});
