import type {IMEContent} from '../types';

/**
 * Enterprise Advanced IME diagram — mirrors the marketing infographic
 * ("Mattermost Intelligent Mission Environment") targeted at national
 * security, defense, and critical-infrastructure buyers.
 *
 * Icons and logos are extracted from the FY27 Platform Pitch Sales
 * Deck (slide 7) and live under `docs/site/static/img/ime/logos/`.
 */
export const entadv: IMEContent = {
  id: 'entadv',
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
        iconSrc: '/img/ime/logos/ms-sync.png',
      },
      columns: 6,
      cells: [
        {
          title: 'Messaging Collaboration',
          body: 'Channels: ChatOps and automation',
          iconSrc: '/img/ime/logos/icon-chat.png',
          to: '/end-user-guide/collaborate/collaborate-index',
        },
        {
          title: 'Workflow & Automation',
          body: 'Integrations & Playbooks: Streamlining SOPs',
          iconSrc: '/img/ime/logos/icon-workflow.png',
          to: '/end-user-guide/workflow-automation/workflow-automation-index',
        },
        {
          title: 'Audio, Screenshare & 1-1 Video',
          body: 'Calls: Live communication w/ transcription & summary',
          iconSrc: '/img/ime/logos/icon-audio.png',
          to: '/end-user-guide/collaborate/audio-and-screensharing',
        },
        {
          title: 'Project Management',
          body: 'Boards: for Kanban & flexible issue tracking',
          iconSrc: '/img/ime/logos/icon-project.png',
          to: '/end-user-guide/project-management/project-management-index',
        },
        {
          title: 'Human-Machine Teaming',
          body: 'Agents: Integration & Human-Machine Teaming',
          iconSrc: '/img/ime/logos/icon-agents.png',
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
            {alt: 'Windows', src: '/img/ime/logos/windows.png'},
            {alt: 'macOS', src: '/img/ime/logos/macos.png'},
            {alt: 'Linux', src: '/img/ime/logos/linux.png'},
            {alt: 'iOS', src: '/img/ime/logos/ios.png'},
            {alt: 'Android', src: '/img/ime/logos/android.png'},
            {alt: 'Microsoft Teams', src: '/img/ime/logos/msteams.png'},
          ],
        },
        {
          text: 'Extensible, audited & hardened open-source supply chain',
          logos: [
            {alt: 'PostgreSQL', src: '/img/ime/logos/postgresql.png'},
            {alt: 'Kubernetes', src: '/img/ime/logos/kubernetes.png'},
            {alt: 'React Native', src: '/img/ime/logos/react-native.png'},
            {alt: 'GitHub', src: '/img/ime/logos/github.png'},
            {alt: 'Go', src: '/img/ime/logos/go.png'},
            {alt: 'Argo', src: '/img/ime/logos/argo.png'},
          ],
        },
      ],
    },
    {
      id: 'interoperability',
      label: 'Interoperability',
      intro: {
        // Deck slide 7 shows the intro column as plain title text with
        // no leading icon and no logo constellation.
        title: 'Accelerates Classified & Mission Partner Operations',
      },
      columns: 2,
      cells: [
        {
          title: 'Advanced Information Controls',
          bullets: [
            'ABAC: Attribute-Based Access Controls',
            'Classification Banners & Labels w/ Data Spillage Mitigation',
            'Tailored data protection: DLP, Expiry, Burn-On-Read',
            'CDS-compatible: Cross-Domain Solution compliant',
            'Crypto-Agile: Post-Quantum, Program-Based, BYOE',
            'Zero-Trust Mobility: MDM & ZT App-Level Controls',
          ],
          icon: 'lock',
          to: '/security-guide/zero-trust',
        },
        {
          // Deck: this box has no logo strip — bullet list only.
          title: 'Secure Federation & Interoperability',
          bullets: [
            'Standards Compatible: ACP 240',
            'Microsoft Teams embedding for Enterprise-to-Edge',
            'MATRIX protocol Interoperability',
            'Guest accounts for controlled access',
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
        // Deck slide 7 shows the intro column as plain title text with
        // no leading icon and no AI-vendor constellation. Those AI
        // vendor logos live inside the Enterprise-to-Edge box in the
        // deck; they've been moved there below.
        title: 'Air-Gapped & Sovereign Deployment & Integration',
      },
      // Deck shows uneven card widths: E2E is the widest, Layered
      // Extensibility is medium, HA is the narrowest. Approximate
      // ratios from the slide.
      columnsTemplate: '1.2fr 1.1fr 0.9fr',
      cells: [
        {
          title: 'Enterprise to Edge with Sovereign AI',
          body: 'Runs at the edge, in your data center, in sovereign/gov & global cloud & AI',
          icon: 'server',
          to: '/deployment-guide/deployment-scenarios/deployment-scenarios-index',
          // Deck: AI-vendor logos pinned to top-right corner.
          cornerLogos: [
            {alt: 'OpenAI', src: '/img/ime/logos/openai.png'},
            {alt: 'Meta', src: '/img/ime/logos/meta.png'},
            {alt: 'Elastic', src: '/img/ime/logos/elastic.png'},
            {alt: 'Ask Sage', src: '/img/ime/logos/ask-sage.png'},
            {alt: 'Mattermost', src: '/img/ime/logos/mattermost.png'},
          ],
          // Deck: deployment targets as text badges + wordmark logos
          // sitting below the body copy.
          logos: [
            {alt: 'Tactical Edge'},
            {alt: 'Local Datacenter'},
            {alt: 'Microsoft Azure', src: '/img/ime/logos/azure.png'},
            {alt: 'Oracle', src: '/img/ime/logos/oracle.png'},
            {alt: 'AWS', src: '/img/ime/logos/aws.png'},
            {alt: 'Google Cloud Platform', src: '/img/ime/logos/gcp.png'},
          ],
        },
        {
          title: 'Layered Extensibility',
          bullets: [
            'Pre-packaged & Custom Integrations',
            'Webhooks & Slash Commands',
            'Plugin Architecture',
          ],
          icon: 'plug',
          to: '/integrations-guide/integrations-guide-index',
          // Deck: dev-tool logos pinned to top-right corner.
          cornerLogos: [
            {alt: 'Jira', src: '/img/ime/logos/jira.png'},
            {alt: 'GitHub', src: '/img/ime/logos/github.png'},
            {alt: 'GitLab', src: '/img/ime/logos/gitlab.png'},
            {alt: 'Element (Matrix)', src: '/img/ime/logos/enterprise-o.png'},
            {alt: 'Splunk', src: '/img/ime/logos/splunk.png'},
          ],
          // Deck: 4-column × 2-row grid of ecosystem logos below the
          // bullets — SIEM/observability, collab, security, workflow.
          logoLayout: 'grid',
          logoColumns: 4,
          logos: [
            {alt: 'Elastic', src: '/img/ime/logos/elastic.png'},
            {alt: 'Microsoft Defender', src: '/img/ime/logos/ms-defender.png'},
            {alt: 'Microsoft Teams', src: '/img/ime/logos/msteams.png'},
            {alt: 'Microsoft Entra ID', src: '/img/ime/logos/ms-entra.png'},
            {alt: 'Microsoft Sync', src: '/img/ime/logos/ms-sync.png'},
            {alt: 'Global Relay', src: '/img/ime/logos/global-relay.png'},
            {alt: 'Confluence', src: '/img/ime/logos/confluence.png'},
            {alt: 'Add integration', src: '/img/ime/logos/plus.png'},
          ],
        },
        {
          title: 'High Availability & Scale',
          bullets: [
            'High & Ultra-High Availability',
            'Scales to 200K+ concurrent users',
            'NATO & US PL3, IL4/5, 6/7 proven',
          ],
          icon: 'shield',
          to: '/administration-guide/scale/high-availability-cluster-based-deployment',
        },
      ],
    },
  ],
};
