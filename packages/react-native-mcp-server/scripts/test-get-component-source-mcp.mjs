#!/usr/bin/env node
/**
 * MCP 도구 get_component_source 호출 테스트.
 * 서버를 stdio로 띄우고 클라이언트로 get_component_source(및 take_snapshot) 호출.
 *
 * 사용법 (패키지 루트에서):
 *   node scripts/test-get-component-source-mcp.mjs
 *   node scripts/test-get-component-source-mcp.mjs --selector 'Text'
 *   node scripts/test-get-component-source-mcp.mjs --uid '0.1'
 *
 * 전제: 빌드 완료(bun run build), 앱 연결 시 소스 위치 반환. 미연결 시 "No React Native app connected" 수신.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const serverPath = path.join(pkgRoot, 'dist', 'index.js');

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

async function main() {
  const selector = getArg('--selector');
  const uid = getArg('--uid');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: pkgRoot,
  });

  const client = new Client({ name: 'test-get-component-source', version: '1.0.0' });
  await client.connect(transport);

  try {
    // 1) take_snapshot 호출 (앱 연결 여부 + uid 확인용)
    const snapshotRes = await client.callTool({
      name: 'take_snapshot',
      arguments: {},
    });
    const snapshotText = snapshotRes.content?.[0]?.text ?? '';
    if (snapshotRes.isError) {
      console.log('take_snapshot:', snapshotText);
    } else {
      let parsed;
      try {
        parsed = JSON.parse(snapshotText);
      } catch {
        parsed = null;
      }
      const nodeCount = parsed?.nodes?.length ?? 0;
      console.log('take_snapshot: OK, nodes:', nodeCount);
    }

    // 2) get_component_source 호출
    const args = {};
    if (uid) args.uid = uid;
    else if (selector) args.selector = selector;
    else args.selector = 'View'; // 기본값

    const res = await client.callTool({
      name: 'get_component_source',
      arguments: args,
    });

    const text = res.content?.[0]?.text ?? '';
    if (res.isError) {
      console.log('get_component_source (error):', text);
    } else {
      console.log('get_component_source (ok):');
      console.log(text);
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
