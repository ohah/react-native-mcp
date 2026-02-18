import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { TestSuite } from './types.js';

const stepSchema = z.union([
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
    }),
  }),
  z.object({ waitForVisible: z.object({ selector: z.string(), timeout: z.number().optional() }) }),
  z.object({
    waitForNotVisible: z.object({ selector: z.string(), timeout: z.number().optional() }),
  }),
  z.object({ assertText: z.object({ text: z.string(), selector: z.string().optional() }) }),
  z.object({ assertVisible: z.object({ selector: z.string() }) }),
  z.object({ assertNotVisible: z.object({ selector: z.string() }) }),
  z.object({ assertCount: z.object({ selector: z.string(), count: z.number() }) }),
  z.object({ screenshot: z.object({ path: z.string().optional() }) }),
  z.object({ wait: z.number() }),
  z.object({ launch: z.string() }),
  z.object({ terminate: z.string() }),
  z.object({ openDeepLink: z.object({ url: z.string() }) }),
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
      direction: z.string().optional(),
      maxScrolls: z.number().optional(),
    }),
  }),
  z.object({ back: z.null().or(z.object({})).default(null) }).strict(),
  z.object({ home: z.null().or(z.object({})).default(null) }).strict(),
  z.object({ hideKeyboard: z.null().or(z.object({})).default(null) }).strict(),
  z.object({ longPress: z.object({ selector: z.string(), duration: z.number().optional() }) }),
  z.object({ addMedia: z.object({ paths: z.array(z.string()).min(1) }) }),
  z.object({ assertHasText: z.object({ text: z.string(), selector: z.string().optional() }) }),
]);

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

export function parseFile(filePath: string): TestSuite {
  const content = readFileSync(filePath, 'utf-8');
  const raw = parseYaml(content);
  const result = suiteSchema.parse(raw);
  return result as TestSuite;
}

export function parseDir(dirPath: string): TestSuite[] {
  const suites: TestSuite[] = [];
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const ext = extname(entry).toLowerCase();
    if ((ext === '.yaml' || ext === '.yml') && statSync(fullPath).isFile()) {
      suites.push(parseFile(fullPath));
    }
  }

  return suites;
}

export function parsePath(target: string): TestSuite[] {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    return parseDir(target);
  }
  return [parseFile(target)];
}
