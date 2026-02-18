import { networkMockRules } from './shared';
import type { NetworkMockRule } from './shared';

var _nextMockId = 0;

export function matchesMockRule(rule: NetworkMockRule, method: string, url: string): boolean {
  if (!rule.enabled) return false;
  if (rule.method && rule.method !== method) return false;
  if (rule.isRegex) {
    try {
      return new RegExp(rule.urlPattern).test(url);
    } catch (_e) {
      return false;
    }
  }
  return url.indexOf(rule.urlPattern) !== -1;
}

export function findMatchingMock(method: string, url: string): NetworkMockRule | null {
  for (var i = 0; i < networkMockRules.length; i++) {
    if (matchesMockRule(networkMockRules[i]!, method, url)) {
      networkMockRules[i]!.hitCount++;
      return networkMockRules[i]!;
    }
  }
  return null;
}

export function addNetworkMock(opts: {
  urlPattern: string;
  isRegex?: boolean;
  method?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  delay?: number;
}): NetworkMockRule {
  var rule: NetworkMockRule = {
    id: ++_nextMockId,
    urlPattern: opts.urlPattern,
    isRegex: !!opts.isRegex,
    method: opts.method ? opts.method.toUpperCase() : null,
    response: {
      status: opts.status != null ? opts.status : 200,
      statusText: opts.statusText || null,
      headers: opts.headers || {},
      body: opts.body != null ? String(opts.body) : '',
      delay: opts.delay != null ? opts.delay : 0,
    },
    enabled: true,
    hitCount: 0,
  };
  networkMockRules.push(rule);
  return rule;
}

export function removeNetworkMock(id: number): boolean {
  for (var i = 0; i < networkMockRules.length; i++) {
    if (networkMockRules[i]!.id === id) {
      networkMockRules.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function listNetworkMocks(): Array<{
  id: number;
  urlPattern: string;
  isRegex: boolean;
  method: string | null;
  status: number;
  enabled: boolean;
  hitCount: number;
}> {
  return networkMockRules.map(function (r) {
    return {
      id: r.id,
      urlPattern: r.urlPattern,
      isRegex: r.isRegex,
      method: r.method,
      status: r.response.status,
      enabled: r.enabled,
      hitCount: r.hitCount,
    };
  });
}

export function clearNetworkMocks(): boolean {
  networkMockRules.length = 0;
  return true;
}
