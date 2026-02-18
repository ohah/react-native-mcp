/**
 * babel.config.js에 MCP babel preset 추가
 */
import fs from 'node:fs';
import type { ProjectInfo } from './detect.js';

const MCP_PRESET = '@ohah/react-native-mcp-server/babel-preset';

export interface BabelConfigResult {
  success: boolean;
  skipped: boolean;
  message: string;
}

export function updateBabelConfig(info: ProjectInfo): BabelConfigResult {
  if (!info.hasBabelConfig || !info.babelConfigPath) {
    return {
      success: false,
      skipped: false,
      message: 'babel.config.js not found — add the preset manually',
    };
  }

  const content = fs.readFileSync(info.babelConfigPath, 'utf-8');

  // 이미 프리셋이 있으면 건너뜀 (멱등성)
  if (content.includes(MCP_PRESET)) {
    return {
      success: true,
      skipped: true,
      message: 'preset already configured',
    };
  }

  // presets 배열의 마지막 항목 뒤에 MCP preset 추가
  // 패턴: presets: [...] 형태에서 마지막 ] 앞에 삽입
  const presetsRegex = /(presets\s*:\s*\[)([\s\S]*?)(\])/;
  const match = content.match(presetsRegex);

  if (!match) {
    return {
      success: false,
      skipped: false,
      message: `Could not find presets array — add manually:\n  presets: [..., '${MCP_PRESET}']`,
    };
  }

  const fullMatch = match[0];
  const before = match[1];
  const presetsContent = match[2];
  const after = match[3];
  if (before === undefined || presetsContent === undefined || after === undefined) {
    return {
      success: false,
      skipped: false,
      message: `Could not find presets array — add manually:\n  presets: [..., '${MCP_PRESET}']`,
    };
  }
  const trimmed = presetsContent.trimEnd();
  // 마지막 문자가 쉼표가 아니면 추가
  const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
  const separator = needsComma ? ',' : '';
  const newContent = content.replace(
    fullMatch,
    `${before}${presetsContent.trimEnd()}${separator} '${MCP_PRESET}'${after}`
  );

  fs.writeFileSync(info.babelConfigPath, newContent, 'utf-8');

  return {
    success: true,
    skipped: false,
    message: 'preset added',
  };
}
