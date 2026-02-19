import * as path from 'node:path';
import { defineConfig, UserConfig } from '@rspress/core';
import pluginMermaid from 'rspress-plugin-mermaid';

const base = '/react-native-mcp/';

const config: UserConfig = {
  root: path.join(__dirname, 'docs'),
  base,
  globalStyles: path.join(__dirname, 'styles/global.css'),
  plugins: [pluginMermaid() as any],
  title: 'React-Native-mcp-server',
  description:
    'MCP server for React Native app automation and monitoring. Use with Cursor, Claude Desktop, and GitHub Actions.',
  logo: `${base}logo.svg`,
  lang: 'en',
  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'React-Native-mcp-server' }],
  ],
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'React-Native-mcp-server',
      description:
        'MCP server for React Native app automation and monitoring. Use with Cursor, Claude Desktop, and GitHub Actions.',
    },
    {
      lang: 'ko',
      label: '한국어',
      title: 'React-Native-mcp-server',
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
