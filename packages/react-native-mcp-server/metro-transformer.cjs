/**
 * Metro 커스텀 transformer 래퍼 (CJS)
 *
 * 1. 진입점: AppRegistry.registerComponent → __REACT_NATIVE_MCP__.registerComponent
 * 2. JSX 파일: testID 자동 주입
 * 3. 기본 @react-native/metro-babel-transformer 로 위임
 *
 * 모노레포·npm 설치 모두 대응: __dirname과 projectRoot 기준으로
 * 상위 디렉터리를 탐색해 node_modules가 있는 루트에서 resolve.
 * 패키지 매니저: npm/yarn(classic)은 require.resolve, Bun(.bun)·pnpm(.pnpm)은 fallback 탐색.
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let defaultTransformer = null;

const MAX_WALK_UP = 10;

/**
 * dir 기준으로 상위로 올라가며 node_modules가 있는 디렉터리들을 수집 (모노레포·npm 공통)
 */
function getCandidateResolutionRoots(dir) {
  const candidates = [];
  let current = path.resolve(dir);
  let steps = 0;
  while (current && current !== path.dirname(current) && steps < MAX_WALK_UP) {
    if (fs.existsSync(path.join(current, 'node_modules'))) {
      candidates.push(current);
    }
    current = path.dirname(current);
    steps += 1;
  }
  return candidates;
}

/** 패키지 매니저별 비호이스트 레이아웃에서 패키지 경로 찾기 (Bun .bun, pnpm .pnpm) */
const HOISTED_LAYOUTS = [
  { dir: '.bun', prefix: '@react-native+metro-babel-transformer@' },
  { dir: '.pnpm', prefix: '@react-native+metro-babel-transformer@' },
];

function findInHoistedLayout(root, nmDir, subdirPrefix) {
  const storeDir = path.join(root, 'node_modules', nmDir);
  if (!fs.existsSync(storeDir)) return null;
  const entries = fs.readdirSync(storeDir, { withFileTypes: true });
  const match = entries.find((d) => d.isDirectory() && d.name.startsWith(subdirPrefix));
  if (!match) return null;
  const pkgNodeModules = path.join(storeDir, match.name, 'node_modules');
  const target = path.join(pkgNodeModules, '@react-native', 'metro-babel-transformer');
  return fs.existsSync(path.join(target, 'package.json')) ? target : null;
}

/**
 * 주어진 roots에서 @react-native/metro-babel-transformer resolve.
 * npm/yarn(classic) → require.resolve. 실패 시 Bun(.bun), pnpm(.pnpm) 레이아웃 fallback.
 */
function resolveDefaultTransformerPath(roots) {
  const flat = [...new Set(roots)].filter(Boolean);
  try {
    return require.resolve('@react-native/metro-babel-transformer', { paths: flat });
  } catch {
    for (const root of flat) {
      for (const { dir, prefix } of HOISTED_LAYOUTS) {
        const target = findInHoistedLayout(root, dir, prefix);
        if (target) return target;
      }
    }
    return null;
  }
}

function getDefaultTransformer(projectRoot) {
  if (defaultTransformer) return defaultTransformer;
  const fromDirname = getCandidateResolutionRoots(__dirname);
  const fromCwd = getCandidateResolutionRoots(process.cwd());
  const fromProject =
    projectRoot && projectRoot !== process.cwd() ? getCandidateResolutionRoots(projectRoot) : [];
  const roots = [projectRoot, process.cwd(), ...fromProject, ...fromDirname, ...fromCwd].flatMap(
    (r) => (r ? [r, path.join(r, 'node_modules')] : [])
  );
  const defaultTransformerPath = resolveDefaultTransformerPath(roots);
  if (!defaultTransformerPath) {
    throw new Error(
      'Cannot find @react-native/metro-babel-transformer. Install it in the app or workspace root.'
    );
  }
  defaultTransformer = require(defaultTransformerPath);
  return defaultTransformer;
}

const transformerEntryPath = path.join(__dirname, 'dist', 'transformer-entry.js');
let transformSourceFn = null;
let injectTestIdsFn = null;

async function loadTransforms() {
  if (transformSourceFn && injectTestIdsFn) return;
  const mod = await import(pathToFileURL(transformerEntryPath).href);
  transformSourceFn = mod.transformSource;
  injectTestIdsFn = mod.injectTestIds;
}

function isMcpEnabled() {
  const v = process.env.REACT_NATIVE_MCP_ENABLED;
  return v === 'true' || v === '1';
}

async function pretransform(filename, src) {
  await loadTransforms();
  let code = src;

  if (!isMcpEnabled()) {
    return code;
  }

  // node_modules 내부 파일은 변환하지 않음 (파서/문법 호환 이슈 방지)
  if (filename.includes('node_modules')) {
    return code;
  }

  if (src.includes('AppRegistry.registerComponent')) {
    const out = await transformSourceFn(code, filename);
    code = out.code;
  }

  const isJsx = /\.(jsx?|tsx?)$/.test(filename) && code.includes('<');
  if (isJsx && injectTestIdsFn) {
    const out = await injectTestIdsFn(code, filename);
    code = out.code;
  }

  return code;
}

module.exports = {
  async transform(config) {
    const projectRoot = config.options?.projectRoot || config.projectRoot || process.cwd();
    const transformer = getDefaultTransformer(projectRoot);
    const { filename, src } = config;
    const newSrc = await pretransform(filename, src);
    return transformer.transform({
      ...config,
      src: newSrc,
    });
  },

  getCacheKey() {
    const projectRoot = process.cwd();
    const transformer = getDefaultTransformer(projectRoot);
    const base = transformer.getCacheKey ? transformer.getCacheKey() : '';
    return base + ':mcp:' + (process.env.REACT_NATIVE_MCP_ENABLED || '');
  },
};
