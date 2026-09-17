import type {IMEContent} from '../types';

/**
 * General-audience IME diagram — the current landing-page content.
 * Softer language than the mission/FedGov variant; suitable for the
 * public docs home.
 */
export const general: IMEContent = {
  id: 'general',
  layers: [
    {
      id: 'use-cases',
      label: 'Use Cases',
      cells: [
        {
          title: 'Cyber Defense',
          body: 'SOC/CERT ops, out-of-band incident response, Red Team',
          icon: 'shield',
          to: '/use-case-guide/integrated-security-operations',
        },
        {
          title: 'DevSecOps',
          body: 'Dev productivity, CI/CD, platform engineering, emergency comms',
          icon: 'code',
          to: '/use-case-guide/devops-collaboration',
        },
        {
          title: 'Mission Operations',
          body: 'Critical workflow, Zero Trust, C2 to tactical edge, joint ops',
          icon: 'compass',
          to: '/use-case-guide/secure-command-and-control',
        },
      ],
    },
    {
      id: 'application',
      label: 'Application',
      intro: {
        title: 'Secure Collaborative Workflow',
        body: 'Messaging collaboration across web, desktop, and mobile with file sharing, audio/screenshare, workflow automation, issue tracking, bots, agents, and open API access — integrating into modern toolchains and legacy systems with advanced customization and security controls.',
        icon: 'layers',
      },
      columns: 5,
      cells: [
        {
          title: 'Messaging Collaboration',
          body: 'Mattermost Channels for ChatOps and automation',
          icon: 'chat',
          to: '/end-user-guide/collaborate/collaborate-index',
        },
        {
          title: 'Workflow Automation',
          body: 'Mattermost Playbooks for automating SOPs',
          icon: 'checklist',
          to: '/end-user-guide/workflow-automation/workflow-automation-index',
        },
        {
          title: 'Audio & Screenshare',
          body: 'Mattermost Calls for real‑time calling and screenshare',
          icon: 'call',
          to: '/end-user-guide/collaborate/audio-and-screensharing',
        },
        {
          title: 'Project Tracking',
          body: 'Mattermost Boards for Kanban and work management',
          icon: 'target',
          to: '/end-user-guide/project-management/project-management-index',
        },
        {
          title: 'AI Agents & Open APIs',
          body: 'Mattermost Agents — AI assistance and integration',
          icon: 'sparkles',
          to: '/end-user-guide/agents',
        },
      ],
      footers: [
        {
          text: 'Desktop, web, mobile & Microsoft Teams clients',
          icon: 'devices',
          to: '/end-user-guide/access/access-your-workspace',
        },
        {
          text: 'Extensible open-source architecture',
          icon: 'code',
          to: '/developers',
        },
      ],
    },
    {
      id: 'integration',
      label: 'Integration',
      intro: {
        title: 'Integration & AI Platform',
        body: 'Operational extensibility with pre-packaged, source-available connectors, automations, and templates for rapid and effective systems integration.',
        icon: 'plug',
      },
      columns: 2,
      cells: [
        {
          title: 'Layered Extensibility',
          bullets: [
            'Pre-packaged and custom integrations',
            'Webhooks and slash commands',
            'Plugin architecture',
          ],
          icon: 'code',
          to: '/integrations-guide/integrations-guide-index',
        },
        {
          title: 'Multi-Agent / Multi-LLM Integration',
          bullets: [
            'Sovereign AI model support via OpenAI APIs',
            'Custom instructions, RAG, semantic search',
            'Responsible AI control plane',
            'MCP and agent-to-agent architecture',
          ],
          icon: 'sparkles',
          to: '/end-user-guide/agents',
        },
      ],
      footers: [
        {
          text: 'Video meetings: Pexip · Webex · Cisco',
          icon: 'video',
          to: '/integrations-guide/integrations-guide-index',
        },
        {
          text: 'Pre-built: GitHub · GitLab · Jira · ServiceNow · M365',
          icon: 'plug',
          to: '/integrations-guide/integrations-guide-index',
        },
      ],
    },
    {
      id: 'deployment',
      label: 'Deployment',
      intro: {
        title: 'Sovereign, Cyber‑Resilient Deployment',
        body: 'Kubernetes-based orchestration on private, government, and air-gapped clouds. Scales from tactical edge to strategic core with geo-distributed ultra-high availability.',
        icon: 'globe',
      },
      columns: 2,
      cells: [
        {
          title: 'Tactical Edge to Strategic Core',
          body: 'Runs at the edge, in your data center, in sovereign clouds, and on global hyperscalers: Azure, AWS, Google Cloud, Oracle Cloud.',
          icon: 'server',
          to: '/deployment-guide/deployment-scenarios/deployment-scenarios-index',
        },
        {
          title: 'Mission-Ready Security & Resilience',
          bullets: [
            'Classified, air-gapped, and DDIL operations',
            'Defense-grade controls, monitoring, and mobile security',
            'Scales to 200K+ users',
          ],
          icon: 'shield',
          to: '/for/air-gapped-operator',
        },
      ],
    },
  ],
};
