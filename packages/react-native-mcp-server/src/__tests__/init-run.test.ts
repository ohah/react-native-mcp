/**
 * runInit 통합 테스트: 단일 레포·모노레포에서 Babel/MCP/gitignore 적용 검증
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runInit } from '../init/index.js';

const MCP_PRESET = '@ohah/react-native-mcp-server/babel-preset';

describe('runInit', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-init-run-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.exitCode = 0;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('RN이 없으면 실패하고 exitCode 1 설정', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const logSpy = { out: '' };
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logSpy.out += args.map(String).join(' ') + '\n';
    };

    await runInit({ interactive: false });

    console.log = origLog;
    expect(process.exitCode).toBe(1);
    expect(logSpy.out).toContain('React Native not found');
  });

  it('--app 경로에 RN 없으면 실패', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const appDir = path.join(tmpDir, 'apps', 'lib');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ name: 'lib', dependencies: {} })
    );
    const logSpy = { out: '' };
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logSpy.out += args.map(String).join(' ') + '\n';
    };

    await runInit({ interactive: false, appPath: 'apps/lib' });

    console.log = origLog;
    expect(process.exitCode).toBe(1);
    expect(logSpy.out).toContain('React Native not found');
  });

  it('단일 레포 성공 시 package.json에 devDependency 추가, Babel·MCP·gitignore 적용', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const babelPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(
      babelPath,
      "module.exports = { presets: ['module:@react-native/babel-preset'] };"
    );
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n');

    await runInit({ interactive: false, client: 'cursor', noInstall: true });

    expect(process.exitCode).toBe(0);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies['@ohah/react-native-mcp-server']).toBeDefined();
    expect(pkg.devDependencies['@ohah/react-native-mcp-server']).toMatch(/^\^0\.\d+\.\d+/);

    const babelContent = fs.readFileSync(babelPath, 'utf-8');
    expect(babelContent).toContain(MCP_PRESET);
    expect(babelContent).toContain('module:@react-native/babel-preset');

    const mcpPath = path.join(tmpDir, '.cursor', 'mcp.json');
    expect(fs.existsSync(mcpPath)).toBe(true);
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    expect(mcp.mcpServers).toBeDefined();
    expect(mcp.mcpServers['react-native-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@ohah/react-native-mcp-server'],
    });

    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('results/');
  });

  it('모노레포 성공 시 앱 package.json에 devDependency 추가, 앱 루트에만 Babel, cwd에 MCP', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
    const appDir = path.join(tmpDir, 'apps', 'mobile');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ name: 'mobile', dependencies: { 'react-native': '0.83.0' } })
    );
    const appBabelPath = path.join(appDir, 'babel.config.js');
    fs.writeFileSync(
      appBabelPath,
      "module.exports = { presets: ['module:@react-native/babel-preset'] };"
    );
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n');

    await runInit({ interactive: false, client: 'cursor', noInstall: true });

    expect(process.exitCode).toBe(0);

    const appPkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf-8'));
    expect(appPkg.devDependencies['@ohah/react-native-mcp-server']).toBeDefined();

    const appBabelContent = fs.readFileSync(appBabelPath, 'utf-8');
    expect(appBabelContent).toContain(MCP_PRESET);

    const mcpPath = path.join(tmpDir, '.cursor', 'mcp.json');
    expect(fs.existsSync(mcpPath)).toBe(true);

    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('results/');
  });

  it('--app 지정 시 해당 앱 package.json에만 devDependency 추가, 해당 앱에만 Babel, MCP는 cwd에', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ workspaces: ['apps/*', 'examples/*'] })
    );
    const app1 = path.join(tmpDir, 'apps', 'mobile');
    const app2 = path.join(tmpDir, 'examples', 'demo');
    fs.mkdirSync(app1, { recursive: true });
    fs.mkdirSync(app2, { recursive: true });
    fs.writeFileSync(
      path.join(app1, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.72.0' } })
    );
    fs.writeFileSync(
      path.join(app2, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const babel1 = path.join(app1, 'babel.config.js');
    const babel2 = path.join(app2, 'babel.config.js');
    fs.writeFileSync(babel1, "module.exports = { presets: ['@react-native/babel-preset'] };");
    fs.writeFileSync(babel2, "module.exports = { presets: ['@react-native/babel-preset'] };");

    await runInit({
      interactive: false,
      client: 'cursor',
      appPath: 'examples/demo',
      noInstall: true,
    });

    expect(process.exitCode).toBe(0);

    const pkg2 = JSON.parse(fs.readFileSync(path.join(app2, 'package.json'), 'utf-8'));
    expect(pkg2.devDependencies['@ohah/react-native-mcp-server']).toBeDefined();
    const pkg1 = JSON.parse(fs.readFileSync(path.join(app1, 'package.json'), 'utf-8'));
    expect(pkg1.devDependencies?.['@ohah/react-native-mcp-server']).toBeUndefined();

    expect(fs.readFileSync(babel2, 'utf-8')).toContain(MCP_PRESET);
    expect(fs.readFileSync(babel1, 'utf-8')).not.toContain(MCP_PRESET);
  });

  it('이미 Babel preset이 있으면 스킵(멱등)', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const babelPath = path.join(tmpDir, 'babel.config.js');
    const initialContent = `module.exports = { presets: ['a', '${MCP_PRESET}'] };`;
    fs.writeFileSync(babelPath, initialContent);

    await runInit({ interactive: false, client: 'cursor', noInstall: true });

    expect(process.exitCode).toBe(0);
    expect(fs.readFileSync(babelPath, 'utf-8')).toBe(initialContent);
  });

  it('이미 .cursor/mcp.json에 react-native-mcp 있으면 스킵', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    fs.writeFileSync(
      path.join(tmpDir, 'babel.config.js'),
      "module.exports = { presets: ['@react-native/babel-preset'] };"
    );
    const cursorDir = path.join(tmpDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const existingMcp = {
      mcpServers: {
        'react-native-mcp': { command: 'npx', args: ['-y', '@ohah/react-native-mcp-server'] },
      },
    };
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify(existingMcp, null, 2));

    await runInit({ interactive: false, client: 'cursor', noInstall: true });

    expect(process.exitCode).toBe(0);
    const after = JSON.parse(fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf-8'));
    expect(Object.keys(after.mcpServers)).toHaveLength(1);
  });

  it('이미 package.json에 @ohah/react-native-mcp-server 있으면 추가 스킵', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { 'react-native': '0.83.0' },
        devDependencies: { '@ohah/react-native-mcp-server': '^0.1.0' },
      })
    );
    fs.writeFileSync(
      path.join(tmpDir, 'babel.config.js'),
      "module.exports = { presets: ['@react-native/babel-preset'] };"
    );
    const logSpy = { out: '' };
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logSpy.out += args.map(String).join(' ') + '\n';
    };

    await runInit({ interactive: false, client: 'cursor', noInstall: true });

    console.log = origLog;
    expect(process.exitCode).toBe(0);
    expect(logSpy.out).toContain('already in package.json');
  });

  it('.gitignore에 이미 results/ 있으면 추가하지 않음', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    fs.writeFileSync(
      path.join(tmpDir, 'babel.config.js'),
      "module.exports = { presets: ['@react-native/babel-preset'] };"
    );
    const gitignorePath = path.join(tmpDir, '.gitignore');
    const before = 'node_modules\n/results/\n';
    fs.writeFileSync(gitignorePath, before);

    await runInit({ interactive: false, client: 'cursor', noInstall: true });

    expect(process.exitCode).toBe(0);
    expect(fs.readFileSync(gitignorePath, 'utf-8')).toBe(before);
  });
});
