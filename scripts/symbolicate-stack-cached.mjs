#!/usr/bin/env node
/**
 * symbolicate-stack.mjs + X-Metro-Delta-ID 캐시.
 * HEAD로 Delta-ID 확인 → 캐시 hit이면 소스맵 재사용, miss면 GET 후 캐시.
 */

import { SourceMapConsumer } from 'source-map';
import https from 'https';
import http from 'http';

const bundleUrl = process.argv[2];
const line = parseInt(process.argv[3], 10);
const column = parseInt(process.argv[4], 10);

if (!bundleUrl || !line) {
  console.error('Usage: node symbolicate-stack-cached.mjs <bundleUrl> <line> <column>');
  process.exit(1);
}

const cache = new Map(); // key: normalizedBundleUrl -> { deltaId, rawMap }

function getLib(url) {
  const u = new URL(url);
  return u.protocol === 'https:' ? https : http;
}

function headUrl(url) {
  return new Promise((resolve, reject) => {
    const req = getLib(url).request(url, { method: 'HEAD' }, (res) => {
      const deltaId = res.headers['x-metro-delta-id'] || null;
      resolve({ deltaId, statusCode: res.statusCode });
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
  const url = match[1].trim();
  if (url.startsWith('data:application/json;charset=utf-8;base64,')) {
    const b64 = url.slice('data:application/json;charset=utf-8;base64,'.length);
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }
  return null;
}

async function main() {
  let url = bundleUrl;
  if (!url.includes('inlineSourceMap=true')) {
    const sep = url.includes('?') ? '&' : '?';
    url = url + sep + 'inlineSourceMap=true';
  }

  const t0 = Date.now();
  const { deltaId } = await headUrl(url);
  const headMs = Date.now() - t0;

  const cacheKey = url;
  let rawMap = null;
  const cached = cache.get(cacheKey);
  if (cached && cached.deltaId === deltaId) {
    rawMap = cached.rawMap;
    console.error('[cache hit] deltaId=%s (HEAD %dms)', deltaId || '', headMs);
  }

  if (!rawMap) {
    const t1 = Date.now();
    const bundleText = await fetchUrl(url);
    const fetchMs = Date.now() - t1;
    rawMap = extractSourceMapFromBundle(bundleText);
    if (!rawMap) {
      console.error('No inline source map in bundle.');
      process.exit(1);
    }
    cache.set(cacheKey, { deltaId, rawMap });
    console.error('[cache miss] GET bundle %dms', fetchMs);
  }

  const t2 = Date.now();
  const consumer = await new SourceMapConsumer(rawMap);
  const pos = consumer.originalPositionFor({ line, column: column || 0 });
  consumer.destroy();
  const lookupMs = Date.now() - t2;

  console.error('lookup %dms', lookupMs);

  if (!pos || pos.source == null) {
    console.log(JSON.stringify({ ok: false, message: 'No mapping for this position' }));
    return;
  }

  console.log(
    JSON.stringify({
      ok: true,
      source: pos.source,
      line: pos.line,
      column: pos.column,
      name: pos.name || undefined,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
