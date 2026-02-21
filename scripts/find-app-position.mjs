#!/usr/bin/env node
/** 번들에서 특정 소스 파일로 매핑되는 (line, col) 하나 찾기 */
import { SourceMapConsumer } from 'source-map';
import https from 'https';
import http from 'http';

const bundleUrl =
  process.argv[2] || 'http://localhost:8230/index.bundle?platform=ios&dev=true&minify=false';
const wantSource = process.argv[3] || 'App.tsx';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    lib
      .get(url + (url.includes('?') ? '&' : '?') + 'inlineSourceMap=true', (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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
  const bundleText = await fetchUrl(bundleUrl);
  const rawMap = extractSourceMapFromBundle(bundleText);
  if (!rawMap) {
    console.error('No source map');
    process.exit(1);
  }
  const consumer = await new SourceMapConsumer(rawMap);
  // eachMapping: find one generated position that maps to wanted source
  let found = null;
  consumer.eachMapping((m) => {
    if (found) return;
    if (m.source && m.source.includes(wantSource)) {
      found = {
        bundleLine: m.generatedLine,
        bundleColumn: m.generatedColumn,
        source: m.source,
        line: m.originalLine,
        column: m.originalColumn,
      };
    }
  });
  if (found) {
    console.log(JSON.stringify({ ok: true, ...found }));
  } else {
    console.log(JSON.stringify({ ok: false, message: 'No mapping found to ' + wantSource }));
  }
  consumer.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
