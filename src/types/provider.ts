/**
 * AI 提供商相关类型
 * 基于原项目 src/modules/ai-providers.js
 */

export interface ModelAlias {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
}

export interface ApiKeyEntry {
  apiKey: string;
  proxyUrl?: string;
  headers?: Record<string, string>;
}

export interface GeminiKeyConfig {
  apiKey: string;
  prefix?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  excludedModels?: string[];
}

export interface ProviderKeyConfig {
  // New fields for multi-key support
  name?: string;
  apiKeyEntries?: string[];  // Array of API keys
  
  // Legacy field for backward compatibility
  apiKey?: string;
  
  // Common fields
  prefix?: string;
  baseUrl?: string;
  proxyUrl?: string;  // Shared by all keys in this provider
  headers?: Record<string, string>;
  models?: ModelAlias[];
  excludedModels?: string[];
  priority?: number;
}

export interface AvailableModelInfo {
  id: string;
  display_name?: string;
  type?: string;
  owned_by?: string;
  context_length?: number;
  max_completion_tokens?: number;
}

export interface ChannelModelsGroup {
  config_key: string;
  models: AvailableModelInfo[];
  count: number;
}

export interface OpenAIProviderConfig {
  name: string;
  prefix?: string;
  baseUrl: string;
  apiKeyEntries: ApiKeyEntry[];
  headers?: Record<string, string>;
  models?: ModelAlias[];
  priority?: number;
  testModel?: string;
  [key: string]: unknown;
}
