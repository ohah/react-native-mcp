#!/usr/bin/env node
/**
 * get_component_source 흐름 검증: Metro 번들 + 소스맵으로 원본 위치가 나오는지 확인.
 * 사용법: Metro + 데모 앱 실행 중에
 *   node scripts/verify-component-source.mjs
 *   node scripts/verify-component-source.mjs --refs '[{"bundleUrl":"...","line":7284,"column":69}]'
 *
 * 옵션:
 *   --refs '[...]'  앱에서 getSourceRefForUid()로 받은 ref 배열 (JSON). 없으면 기본 ref 1개 사용.
 */

import { getSourcePosition } from './symbolicate-lib.mjs';

const BASE_URL =
  process.env.METRO_URL || 'http://localhost:8230/index.bundle?platform=ios&dev=true&minify=false';

function normalizeUrl(url) {
  return url.replace(/\/\/&/, '?&');
}

async function main() {
  const args = process.argv.slice(2);
  let refs = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--refs' && args[i + 1]) {
      try {
        refs = JSON.parse(args[++i]);
      } catch (e) {
        console.error('--refs JSON parse error:', e.message);
        process.exit(1);
      }
    }
  }

  if (!refs || !Array.isArray(refs) || refs.length === 0) {
    refs = [{ bundleUrl: BASE_URL, line: 7284, column: 69 }];
    console.log("Using default ref. Pass --refs '[...]' for full stack.\n");
  }

  const isAppSource = (s) =>
    s && !s.includes('node_modules/react') && !s.includes('node_modules/react-native');

  const ref = refs[0];
  const pos = await getSourcePosition(normalizeUrl(ref.bundleUrl), ref.line, ref.column, {
    useCache: true,
  });
  if (!pos.ok) {
    console.log('FAIL:', pos.message);
    process.exit(1);
  }
  console.log('OK:', pos.source, pos.line, pos.column);

  if (refs.length > 1) {
    for (const r of refs) {
      const p = await getSourcePosition(normalizeUrl(r.bundleUrl), r.line, r.column, {
        useCache: true,
      });
      if (p.ok && isAppSource(p.source)) {
        console.log('First app frame:', p.source, p.line, p.column);
        break;
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
