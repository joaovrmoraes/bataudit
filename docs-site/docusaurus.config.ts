import { themes as prismThemes } from 'prism-react-renderer'
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

const config: Config = {
  title: 'BatAudit Docs',
  tagline: 'Self-hosted audit logging for SaaS',
  favicon: 'img/favicon.png',

  url: 'https://docs.bataudit.com',
  baseUrl: '/',

  organizationName: 'joaovrmoraes',
  projectName: 'bataudit',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/joaovrmoraes/bataudit/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    navbar: {
      title: 'BatAudit',
      logo: {
        alt: 'BatAudit logo',
        src: 'img/bat.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://bataudit.com',
          label: 'Website',
          position: 'right',
        },
        {
          href: 'https://demo.bataudit.com/app',
          label: 'Live Demo',
          position: 'right',
        },
        {
          href: 'https://github.com/joaovrmoraes/bataudit',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/getting-started/installation' },
            { label: 'Node.js SDK', to: '/sdks/nodejs' },
            { label: 'API Reference', to: '/api-reference/events' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: 'https://github.com/joaovrmoraes/bataudit' },
            { label: 'Issues', href: 'https://github.com/joaovrmoraes/bataudit/issues' },
            { label: 'Live Demo', href: 'https://demo.bataudit.com/app' },
          ],
        },
      ],
      copyright: `MIT License — BatAudit`,
    },

    prism: {
      theme: prismThemes.oneDark,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['bash', 'json', 'typescript', 'go', 'docker', 'yaml'],
    },

    algolia: undefined,
  } satisfies Preset.ThemeConfig,
}

export default config
