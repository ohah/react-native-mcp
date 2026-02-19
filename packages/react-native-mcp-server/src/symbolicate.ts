/**
 * Metro 번들 URL + (line, column) → 소스맵으로 원본 파일/라인 추론.
 * X-Metro-Delta-ID로 캐시하여 핫 리로드 시 무효화.
 */

import { SourceMapConsumer } from 'source-map';
import https from 'https';
import http from 'http';

const cache = new Map<string, { deltaId: string | null; rawMap: unknown }>();

function getLib(url: string): typeof http {
  try {
    return url.startsWith('https:') ? https : http;
  } catch {
    return http;
  }
}

function headUrl(url: string): Promise<{ deltaId: string | null }> {
  return new Promise((resolve, reject) => {
    const req = getLib(url).request(url, { method: 'HEAD' }, (res) => {
      const deltaId = (res.headers['x-metro-delta-id'] as string) ?? null;
      resolve({ deltaId });
    });
    req.on('error', reject);
    req.end();
  });
}

/** 대용량 번들(20~30MB)에서 Cold 단축: 끝 N바이트만 요청. 서버가 206 미지원 시 null 반환. */
const TAIL_BYTES = 4 * 1024 * 1024; // 4MB — 인라인 소스맵은 보통 번들 끝에 있음

function fetchUrlTail(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = getLib(url).request(
      url,
      { method: 'GET', headers: { Range: `bytes=-${TAIL_BYTES}` } },
      (res) => {
        if (res.statusCode !== 206) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => resolve(null));
      }
    );
    req.on('error', () => resolve(null));
    req.end();
  });
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    getLib(url)
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function extractSourceMapFromBundle(bundleText: string): unknown | null {
  const match = bundleText.match(/\/\/# sourceMappingURL=(.+)/);
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.startsWith('data:application/json;charset=utf-8;base64,')) {
    const b64 = raw.slice('data:application/json;charset=utf-8;base64,'.length);
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as unknown;
  }
  return null;
}

export interface SourcePosition {
  ok: true;
  source: string;
  line: number | null;
  column: number | null;
  name?: string;
}

export interface SourcePositionError {
  ok: false;
  message: string;
}

/**
 * 번들 위치를 원본 소스 위치로 변환. useCache 시 HEAD로 Delta-ID 확인 후 캐시 사용.
 */
/** 앱에서 오는 URL이 index.bundle//&... 형태일 수 있음. */
function normalizeBundleUrl(bundleUrl: string): string {
  return bundleUrl.replace(/\/\/&/, '?&');
}

export async function getSourcePosition(
  bundleUrl: string,
  line: number,
  column: number,
  options: { useCache?: boolean } = {}
): Promise<SourcePosition | SourcePositionError> {
  const useCache = options.useCache !== false;
  let url = normalizeBundleUrl(bundleUrl);
  if (!url.includes('inlineSourceMap=true')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}inlineSourceMap=true`;
  }

  let rawMap: unknown = null;

  async function fetchRawMap(): Promise<unknown | null> {
    const tail = await fetchUrlTail(url);
    if (tail) {
      const fromTail = extractSourceMapFromBundle(tail);
      if (fromTail) return fromTail;
    }
    const bundleText = await fetchUrl(url);
    return extractSourceMapFromBundle(bundleText);
  }

  if (useCache) {
    const { deltaId } = await headUrl(url);
    const cached = cache.get(url);
    if (cached && cached.deltaId === deltaId) {
      rawMap = cached.rawMap;
    }
    if (!rawMap) {
      rawMap = await fetchRawMap();
      if (rawMap) cache.set(url, { deltaId, rawMap });
    }
  } else {
    rawMap = await fetchRawMap();
  }

  if (!rawMap) {
    return { ok: false, message: 'No source map in bundle' };
  }

  const consumer = await new SourceMapConsumer(
    rawMap as Parameters<typeof SourceMapConsumer.new>[0]
  );
  const pos = consumer.originalPositionFor({ line, column: column || 0 });
  consumer.destroy();

  if (!pos || pos.source == null) {
    return { ok: false, message: 'No mapping for this position' };
  }

  return {
    ok: true,
    source: pos.source,
    line: pos.line,
    column: pos.column,
    name: pos.name ?? undefined,
  };
}
