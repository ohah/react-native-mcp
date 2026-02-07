/**
 * 통합 개발 환경 스크립트
 * 모든 패키지의 개발 서버를 동시에 실행합니다.
 */

import { spawn, type ChildProcess } from 'node:child_process';

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
} as const;

interface ServiceConfig {
  name: string;
  color: string;
  command: string;
  args: string[];
  cwd?: string;
}

const services: ServiceConfig[] = [
  {
    name: 'SERVER',
    color: colors.green,
    command: 'bun',
    args: ['run', '--filter=@ohah/react-native-mcp-server', 'dev'],
  },
];

const processes: ChildProcess[] = [];

function log(service: string, color: string, message: string): void {
  const prefix = `${color}[${service}]${colors.reset}`;
  for (const line of message.split('\n')) {
    if (line.trim()) {
      console.log(`${prefix} ${line}`);
    }
  }
}

function startService(config: ServiceConfig): ChildProcess {
  const proc = spawn(config.command, config.args, {
    cwd: config.cwd ?? process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  proc.stdout?.on('data', (data: Buffer) => {
    log(config.name, config.color, data.toString());
  });

  proc.stderr?.on('data', (data: Buffer) => {
    log(config.name, config.color, data.toString());
  });

  proc.on('exit', (code) => {
    log(config.name, config.color, `프로세스 종료 (코드: ${code})`);
  });

  return proc;
}

// 모든 서비스 시작
for (const service of services) {
  processes.push(startService(service));
}

log('DEV', colors.cyan, '모든 서비스가 시작되었습니다. Ctrl+C로 종료합니다.');

// 종료 시 모든 프로세스 정리
function cleanup(): void {
  log('DEV', colors.cyan, '모든 서비스를 종료합니다...');
  for (const proc of processes) {
    proc.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
