import type {IMEContent} from '../types';

/**
 * Mission / National-Security IME diagram — mirrors the marketing
 * infographic ("Mattermost Intelligent Mission Environment") targeted
 * at national security, defense, and critical-infrastructure buyers.
 *
 * Logo `src` paths point at `/img/logos/*.svg`; drop files there to
 * replace the text-badge fallback with real brand marks.
 */
export const mission: IMEContent = {
  id: 'mission',
  title: 'Mattermost Intelligent Mission Environment',
  tagline: 'Self-managed collaborative workflow and AI automation for national security and critical infrastructure enterprises',
  layers: [
    {
      id: 'use-cases',
      label: 'Use Cases',
      cells: [
        {
          title: 'Cybersecurity Operations',
          body: 'SOC/CERT ops, out-of-band incident response, Red Team/pen test, cyber ops, threat hunting/intel sharing',
          icon: 'shield',
          to: '/use-case-guide/integrated-security-operations',
        },
        {
          title: 'DevSecOps',
          body: 'Build, secure & operate vital digital systems. Developer productivity, CI/CD, platform engineering, emergency comms',
          icon: 'code',
          to: '/use-case-guide/devops-collaboration',
        },
        {
          title: 'Real-World & Mission Operations',
          body: 'Zero Trust controls & mobility, C2-to-edge, joint operations, cross-domain operations',
          icon: 'compass',
          to: '/use-case-guide/secure-command-and-control',
        },
      ],
    },
    {
      id: 'applications',
      label: 'Applications',
      intro: {
        title: 'Zero Trust Collaboration, Workflow & Automation',
        icon: 'layers',
      },
      columns: 6,
      cells: [
        {
          title: 'Messaging Collaboration',
          body: 'Channels: ChatOps and automation',
          icon: 'chat',
          to: '/end-user-guide/collaborate/collaborate-index',
        },
        {
          title: 'Workflow & Automation',
          body: 'Integrations & Playbooks: Streamlining SOPs',
          icon: 'checklist',
          to: '/end-user-guide/workflow-automation/workflow-automation-index',
        },
        {
          title: 'Audio, Screenshare & 1-1 Video',
          body: 'Calls: Live communication w/ transcription & summary',
          icon: 'call',
          to: '/end-user-guide/collaborate/audio-and-screensharing',
        },
        {
          title: 'Project Management',
          body: 'Boards: for Kanban & flexible issue tracking',
          icon: 'target',
          to: '/end-user-guide/project-management/project-management-index',
        },
        {
          title: 'Human-Machine Teaming',
          body: 'Agents: Integration & Human-Machine Teaming',
          icon: 'sparkles',
          to: '/end-user-guide/agents',
        },
        {
          title: 'Future Applications',
          body: 'New integrated applications to meet customer needs',
          icon: 'star',
        },
      ],
      footers: [
        {
          text: 'Web, Desktop, Mobile & MS Teams user experiences',
          logos: [
            {alt: 'Microsoft Teams'},
            {alt: 'Outlook'},
            {alt: 'Slack'},
            {alt: 'Mattermost'},
          ],
        },
        {
          text: 'Extensible, audited & hardened open-source supply chain',
          logos: [
            {alt: 'PostgreSQL'},
            {alt: 'React'},
            {alt: 'Redis'},
            {alt: 'Docker'},
            {alt: 'GitHub'},
            {alt: 'Go'},
          ],
        },
      ],
    },
    {
      id: 'interoperability',
      label: 'Interoperability',
      intro: {
        title: 'Accelerates Classified & Mission Partner Operations',
        icon: 'network',
      },
      columns: 2,
      cells: [
        {
          title: 'Advanced Information Controls',
          bullets: [
            'ABAC: Attribute-Based Access Controls',
            'Classification Labels w/ Data Spillage Mitigation',
            'Tailored Data Controls: DLP, Expiry, Burn-On-Read',
            'CDS-compatible: Cross-Domain Solution compliant',
            'Crypto-Agile: Post-Quantum, Program-Based, BYOE',
            'Zero-Trust Mobility: MDM & ZT App-Level Controls',
          ],
          icon: 'lock',
          to: '/security-guide/zero-trust',
        },
        {
          title: 'Secure Federation & Interop',
          bullets: [
            'Standards Compatible: ACP 240',
            'Microsoft Teams embed for Enterprise-to-Edge',
            'MATRIX protocol Interoperability',
            'Guest accounts for external collaboration',
            'Shared channels for inter-server communication',
            'Language translation in real-time, on-premise',
          ],
          icon: 'users',
          to: '/administration-guide/onboard/connected-workspaces',
        },
      ],
    },
    {
      id: 'deployment',
      label: 'Deployment',
      intro: {
        title: 'Deploy Air-Gapped & Sovereign',
        icon: 'globe',
      },
      columns: 3,
      cells: [
        {
          title: 'Enterprise to Edge w/ Sovereign AI',
          body: 'Edge, Data Center, Sovereign/Gov & Global Cloud & AI',
          icon: 'server',
          to: '/deployment-guide/deployment-scenarios/deployment-scenarios-index',
          logos: [
            {alt: 'Tactical Edge'},
            {alt: 'Local Datacenter'},
            {alt: 'Microsoft Azure'},
            {alt: 'Oracle'},
            {alt: 'AWS'},
          ],
        },
        {
          title: 'Layered Extensibility',
          bullets: [
            'Packaged & Custom Integrations',
            'Webhooks & Slash Commands',
            'Plugin Architecture',
          ],
          icon: 'plug',
          to: '/integrations-guide/integrations-guide-index',
          logos: [
            {alt: 'GitHub'},
            {alt: 'GitLab'},
            {alt: 'Jira'},
            {alt: 'ServiceNow'},
            {alt: 'M365'},
          ],
        },
        {
          title: 'High Availability & Scale',
          bullets: [
            'High & Ultra-High Availability',
            'Scales to 200K+ users',
            'NATO & US PL3, IL4/5, 6/7',
          ],
          icon: 'shield',
          to: '/for/air-gapped-operator',
        },
      ],
    },
  ],
};
