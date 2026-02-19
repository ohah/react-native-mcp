/**
 * 심볼리케이트 공통 로직. 캐시 옵션 지원.
 * getSourcePosition(url, line, col, { useCache }) -> { ok, source, line, column }
 */

import { SourceMapConsumer } from 'source-map';
import https from 'https';
import http from 'http';

const cache = new Map();

function getLib(url) {
  const u = new URL(url);
  return u.protocol === 'https:' ? https : http;
}

function headUrl(url) {
  return new Promise((resolve, reject) => {
    const req = getLib(url).request(url, { method: 'HEAD' }, (res) => {
      resolve({ deltaId: res.headers['x-metro-delta-id'] || null });
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    getLib(url)
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function extractSourceMapFromBundle(bundleText) {
  const match = bundleText.match(/\/\/# sourceMappingURL=(.+)/);
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.startsWith('data:application/json;charset=utf-8;base64,')) {
    const b64 = raw.slice('data:application/json;charset=utf-8;base64,'.length);
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }
  return null;
}

export async function getSourcePosition(bundleUrl, line, column = 0, { useCache = true } = {}) {
  let url = bundleUrl;
  if (!url.includes('inlineSourceMap=true')) {
    const sep = url.includes('?') ? '&' : '?';
    url = url + sep + 'inlineSourceMap=true';
  }

  let rawMap = null;

  if (useCache) {
    const { deltaId } = await headUrl(url);
    const cached = cache.get(url);
    if (cached && cached.deltaId === deltaId) {
      rawMap = cached.rawMap;
    }
    if (!rawMap) {
      const bundleText = await fetchUrl(url);
      rawMap = extractSourceMapFromBundle(bundleText);
      if (rawMap) cache.set(url, { deltaId, rawMap });
    }
  } else {
    const bundleText = await fetchUrl(url);
    rawMap = extractSourceMapFromBundle(bundleText);
  }

  if (!rawMap) return { ok: false, message: 'No source map' };

  const consumer = await new SourceMapConsumer(rawMap);
  const pos = consumer.originalPositionFor({ line, column: column || 0 });
  consumer.destroy();

  if (!pos || pos.source == null) return { ok: false, message: 'No mapping' };

  return {
    ok: true,
    source: pos.source,
    line: pos.line,
    column: pos.column,
    name: pos.name,
  };
}
