import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/first-event',
        'getting-started/dashboard',
      ],
    },
    {
      type: 'category',
      label: 'SDKs',
      items: [
        'sdks/nodejs',
        'sdks/browser',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/events',
        'api-reference/sessions',
        'api-reference/export',
        'api-reference/anomalies',
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/anomaly-detection',
        'concepts/data-tiering',
        'concepts/notifications',
      ],
    },
    {
      type: 'category',
      label: 'Self-Hosting',
      items: [
        'self-hosting/configuration',
        'self-hosting/production',
        'self-hosting/postgresql',
        'self-hosting/sqlite',
      ],
    },
  ],
}

export default sidebars
