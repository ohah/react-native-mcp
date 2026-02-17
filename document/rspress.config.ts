import * as path from 'node:path';
import { defineConfig } from '@rspress/core';
import type { UserConfig } from '@rspress/shared';

const base = '/react-native-mcp/';

const config: UserConfig = {
  root: path.join(__dirname, 'docs'),
  base,
  logo: `${base}logo.svg`,
  lang: 'en',
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'React Native MCP',
      description:
        'MCP server for React Native app automation and monitoring. Use with Cursor, Claude Desktop, and GitHub Actions.',
    },
    {
      lang: 'ko',
      label: '한국어',
      title: 'React Native MCP',
      description:
        'React Native 앱 자동화·모니터링을 위한 MCP 서버. Cursor, Claude Desktop, GitHub Actions에서 사용할 수 있습니다.',
    },
  ],
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/ohah/react-native-mcp',
      },
    ],
    outlineTitle: 'Contents',
    prevPageText: 'Previous',
    nextPageText: 'Next',
    locales: [
      {
        lang: 'en',
        outlineTitle: 'Contents',
        prevPageText: 'Previous',
        nextPageText: 'Next',
      },
      {
        lang: 'ko',
        outlineTitle: '목차',
        prevPageText: '이전',
        nextPageText: '다음',
      },
    ],
  },
  route: {
    cleanUrls: true,
  },
  builderConfig: {
    output: {
      distPath: {
        root: 'doc_build',
      },
    },
  },
};

export default defineConfig(config);
