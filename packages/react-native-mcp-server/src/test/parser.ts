import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { TestSuite } from './types.js';

/* ------------------------------------------------------------------ */
/*  ${VAR} 환경 변수 치환                                              */
/* ------------------------------------------------------------------ */

function interpolateVars(obj: unknown, vars: Record<string, string>): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }
  if (Array.isArray(obj)) return obj.map((item) => interpolateVars(item, vars));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, interpolateVars(v, vars)])
    );
  }
  return obj;
}

/* ------------------------------------------------------------------ */
/*  Zod 스텝 스키마 (z.lazy로 재귀 지원)                                */
/* ------------------------------------------------------------------ */

const stepSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      tap: z.object({
        selector: z.string(),
        duration: z.number().optional(),
      }),
    }),
    z.object({
      swipe: z.object({
        selector: z.string(),
        direction: z.string(),
        distance: z.union([z.number(), z.string()]).optional(),
        duration: z.number().optional(),
      }),
    }),
    z.object({ typeText: z.object({ selector: z.string(), text: z.string() }) }),
    z.object({ inputText: z.object({ text: z.string() }) }),
    z.object({ pressButton: z.object({ button: z.string() }) }),
    z.object({
      waitForText: z.object({
        text: z.string(),
        timeout: z.number().optional(),
        selector: z.string().optional(),
        interval: z.number().optional(),
      }),
    }),
    z.object({
      waitForVisible: z.object({ selector: z.string(), timeout: z.number().optional(), interval: z.number().optional() }),
    }),
    z.object({
      waitForNotVisible: z.object({ selector: z.string(), timeout: z.number().optional(), interval: z.number().optional() }),
    }),
    z.object({ assertText: z.object({ text: z.string(), selector: z.string().optional() }) }),
    z.object({ assertVisible: z.object({ selector: z.string() }) }),
    z.object({ assertNotVisible: z.object({ selector: z.string() }) }),
    z.object({ assertCount: z.object({ selector: z.string(), count: z.number().optional(), minCount: z.number().optional(), maxCount: z.number().optional() }) }),
    z.object({ screenshot: z.object({ path: z.string().optional() }) }),
    z.object({ wait: z.number() }),
    z.object({ launch: z.string() }),
    z.object({ terminate: z.string() }),
    z.object({ openDeepLink: z.object({ url: z.string() }) }),
    z.object({ clearState: z.string() }),
    z.object({
      setLocation: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
    }),
    z.object({ copyText: z.object({ selector: z.string() }) }),
    z.object({ pasteText: z.null().or(z.object({}).strict()).default(null) }).strict(),
    z.object({ evaluate: z.object({ script: z.string() }) }),
    z.object({
      webviewEval: z.object({
        webViewId: z.string(),
        script: z.string(),
      }),
    }),
    z.object({
      scrollUntilVisible: z.object({
        selector: z.string(),
        scrollableSelector: z.string().optional(),
        direction: z.string().optional(),
        maxScrolls: z.number().optional(),
      }),
    }),
    z.object({ back: z.null().or(z.object({})).default(null) }).strict(),
    z.object({ home: z.null().or(z.object({})).default(null) }).strict(),
    z.object({ hideKeyboard: z.null().or(z.object({})).default(null) }).strict(),
    z.object({ longPress: z.object({ selector: z.string(), duration: z.number().optional() }) }),
    z.object({ addMedia: z.object({ paths: z.array(z.string()).min(1) }) }),
    z.object({ clearText: z.object({ selector: z.string() }) }),
    z.object({ doubleTap: z.object({ selector: z.string(), interval: z.number().optional() }) }),
    z.object({ assertValue: z.object({ selector: z.string(), expected: z.string() }) }),
    // Phase 2 — 흐름 제어
    z.object({
      repeat: z.object({
        times: z.number(),
        steps: z.array(stepSchema).min(1),
      }),
    }),
    z.object({ runFlow: z.string() }),
    z.object({
      if: z.object({
        platform: z.enum(['ios', 'android']).optional(),
        visible: z.string().optional(),
        steps: z.array(stepSchema).min(1),
      }),
    }),
    z.object({
      retry: z.object({
        times: z.number(),
        steps: z.array(stepSchema).min(1),
      }),
    }),
    // Network mocking
    z.object({
      mockNetwork: z.object({
        urlPattern: z.string(),
        isRegex: z.boolean().optional(),
        method: z.string().optional(),
        status: z.number().optional(),
        statusText: z.string().optional(),
        headers: z.record(z.string()).optional(),
        body: z.string().optional(),
        delay: z.number().optional(),
      }),
    }),
    z.object({ clearNetworkMocks: z.null().or(z.object({})).default(null) }).strict(),
    // Visual regression
    z.object({
      compareScreenshot: z.object({
        baseline: z.string(),
        selector: z.string().optional(),
        threshold: z.number().min(0).max(1).optional(),
        update: z.boolean().optional(),
        saveDiff: z.string().optional(),
        saveCurrent: z.string().optional(),
      }),
    }),
    // Video recording (v2)
    z.object({
      startRecording: z.object({ path: z.string().optional() }),
    }),
    z.object({ stopRecording: z.null().or(z.object({}).strict()).default(null) }).strict(),
  ])
);

const suiteSchema = z.object({
  name: z.string(),
  config: z.object({
    platform: z.enum(['ios', 'android']),
    timeout: z.number().optional(),
    bundleId: z.union([z.string(), z.object({ ios: z.string(), android: z.string() })]).optional(),
    deviceId: z.string().optional(),
  }),
  setup: z.array(stepSchema).optional(),
  steps: z.array(stepSchema).min(1),
  teardown: z.array(stepSchema).optional(),
});

/* ------------------------------------------------------------------ */
/*  파싱 API                                                           */
/* ------------------------------------------------------------------ */

export function parseFile(filePath: string, envVars?: Record<string, string>): TestSuite {
  const content = readFileSync(filePath, 'utf-8');
  const raw = parseYaml(content);
  const vars: Record<string, string> = {};
  // process.env 값 중 string인 것만 포함
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) vars[k] = v;
  }
  // CLI --env 값이 process.env를 오버라이드
  if (envVars) Object.assign(vars, envVars);
  const interpolated = interpolateVars(raw, vars);
  const result = suiteSchema.parse(interpolated);
  return { ...result, filePath: resolve(filePath) } as TestSuite;
}

export function parseDir(dirPath: string, envVars?: Record<string, string>): TestSuite[] {
  const suites: TestSuite[] = [];
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const ext = extname(entry).toLowerCase();
    if ((ext === '.yaml' || ext === '.yml') && statSync(fullPath).isFile()) {
      suites.push(parseFile(fullPath, envVars));
    }
  }

  return suites;
}

export function parsePath(target: string, envVars?: Record<string, string>): TestSuite[] {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    return parseDir(target, envVars);
  }
  return [parseFile(target, envVars)];
}
