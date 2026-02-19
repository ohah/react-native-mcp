#!/usr/bin/env node
/**
 * Metro 번들 URL + (line, column) → 소스맵으로 원본 파일/라인 추론.
 * 사용: node scripts/symbolicate-stack.mjs <bundleUrl> <line> <column>
 * bundleUrl에 inlineSourceMap=true 없으면 내부에서 붙여서 요청함.
 */

import { SourceMapConsumer } from 'source-map';
import https from 'https';
import http from 'http';

const bundleUrl = process.argv[2];
const line = parseInt(process.argv[3], 10);
const column = parseInt(process.argv[4], 10);

if (!bundleUrl || !line) {
  console.error('Usage: node symbolicate-stack.mjs <bundleUrl> <line> <column>');
  process.exit(1);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    lib
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

  console.error('Fetching bundle:', url.slice(0, 80) + '...');
  const bundleText = await fetchUrl(url);
  const rawMap = extractSourceMapFromBundle(bundleText);
  if (!rawMap) {
    console.error('No inline source map found in bundle.');
    process.exit(1);
  }

  const consumer = await new SourceMapConsumer(rawMap);
  // source-map: line is 1-based
  const pos = consumer.originalPositionFor({ line, column: column || 0 });
  consumer.destroy();

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
