#!/usr/bin/env node
/**
 * Metro(또는 번들 서버)가 HTTP Range 요청을 지원하는지 확인.
 * 사용법: Metro 실행 중에
 *   node scripts/check-range-support.mjs
 *   METRO_URL=http://localhost:8081/index.bundle?platform=android node scripts/check-range-support.mjs
 *
 * Range 지원 시: 206 Partial Content + 끝 N바이트만 수신 → 대용량 번들 Cold 단축 가능.
 * 미지원 시: 200 OK + 전체 본문 수신 (현재 Metro dev 서버 기본).
 *
 * 참고: Facebook Metro 공식 구현에는 Range/206/Accept-Ranges 처리 코드가 없음(GitHub 검색 0건).
 *       다른 번들 서버나 프록시를 쓰면 206이 올 수 있으므로, 환경별로 이 스크립트로 확인하면 됨.
 */

const BASE_URL =
  process.env.METRO_URL ||
  'http://localhost:8230/index.bundle?platform=ios&dev=true&minify=false&inlineSourceMap=true';

async function main() {
  const url = BASE_URL;
  const tailBytes = 1024; // 1KB만 요청
  const http = url.startsWith('https:')
    ? (await import('https')).default
    : (await import('http')).default;

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: 'GET', headers: { Range: `bytes=-${tailBytes}` } },
      (res) => {
        const status = res.statusCode;
        const acceptRanges = res.headers['accept-ranges'];
        const contentRange = res.headers['content-range'];

        let bodyLength = 0;
        res.on('data', (c) => {
          bodyLength += c.length;
        });
        res.on('end', () => {
          const rangeWorks = status === 206 && bodyLength <= tailBytes;
          console.log('URL:', url.split('?')[0], '...');
          console.log(
            'Status:',
            status,
            rangeWorks ? '(Range 동작)' : status === 200 ? '(전체 응답)' : ''
          );
          console.log('Accept-Ranges:', acceptRanges ?? '(없음)');
          console.log('Content-Range:', contentRange ?? '(없음)');
          console.log('수신 바이트:', bodyLength, rangeWorks ? '(요청한 tail만)' : '');
          console.log('');
          if (rangeWorks) {
            console.log('→ Range 동작 환경: 대용량 번들 Cold 시 tail만 받아 Cold 단축 가능.');
          } else {
            console.log('→ Range 미지원: Cold 시 전체 번들 다운로드 (20~30MB면 수 초 소요).');
          }
          resolve();
        });
        res.on('error', reject);
      }
    );
    req.on('error', (e) => {
      console.error('요청 실패 (Metro 떠 있는지 확인):', e.message);
      resolve();
    });
    req.end();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
