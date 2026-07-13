import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

/**
 * Interactive Intelligent Mission Environment (IME) diagram.
 *
 * Recreates the four-layer IME infographic (Use Cases → Application →
 * Integration → Deployment) with every region linked to its canonical
 * documentation page. Replaces the static infographic image on the
 * landing page so visitors can drill into the docs from the diagram
 * itself.
 */

type CellProps = {
  to: string;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
};

function Cell({to, title, children, icon}: CellProps) {
  return (
    <Link to={to} className={styles.cell}>
      {icon && <span className={styles.icon} aria-hidden>{icon}</span>}
      <div className={styles.cellBody}>
        <strong className={styles.cellTitle}>{title}</strong>
        <div className={styles.cellText}>{children}</div>
      </div>
    </Link>
  );
}

/* === Inline brand-aligned SVG icons (marigold tone via currentColor) === */
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);
const IconChecklist = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconCall = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconSparkles = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconCode = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const IconServer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="6" rx="1"/>
    <rect x="2" y="15" width="20" height="6" rx="1"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/>
    <line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);
const IconCompass = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);
const IconLayers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);
const IconPlug = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IconDevices = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="14" height="11" rx="1"/>
    <rect x="14" y="9" width="8" height="11" rx="1"/>
    <line x1="2" y1="17" x2="11" y2="17"/>
  </svg>
);
const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);

export default function IMEDiagram() {
  return (
    <section className={styles.diagram} aria-label="Intelligent Mission Environment overview">
      {/* USE CASES */}
      <div className={`${styles.layer} ${styles.layerUseCases}`}>
        <div className={styles.layerLabel}>Use Cases</div>
        <div className={styles.layerBody}>
          <div className={styles.useCaseRow}>
            <Cell to="/use-case-guide/integrated-security-operations" title="Cyber Defense" icon={<IconShield />}>
              SOC/CERT ops, out-of-band incident response, Red Team
            </Cell>
            <Cell to="/use-case-guide/devops-collaboration" title="DevSecOps" icon={<IconCode />}>
              Dev productivity, CI/CD, platform engineering, emergency comms
            </Cell>
            <Cell to="/use-case-guide/secure-command-and-control" title="Mission Operations" icon={<IconCompass />}>
              Critical workflow, Zero Trust, C2 to tactical edge, joint ops
            </Cell>
          </div>
        </div>
      </div>

      {/* APPLICATION */}
      <div className={`${styles.layer} ${styles.layerApplication}`}>
        <div className={styles.layerLabel}>Application</div>
        <div className={styles.layerBody}>
          <div className={styles.appGrid}>
            <div className={styles.appIntro}>
              <h3><span className={styles.introIcon}><IconLayers /></span>Secure Collaborative Workflow</h3>
              <p>
                Messaging collaboration across web, desktop, and mobile with file sharing,
                audio/screenshare, workflow automation, issue tracking, bots, agents, and open
                API access — integrating into modern toolchains and legacy systems with
                advanced customization and security controls.
              </p>
            </div>
            <div className={styles.productGrid}>
              <Cell to="/end-user-guide/messaging-collaboration" title="Messaging Collaboration" icon={<IconChat />}>
                Mattermost Channels for ChatOps and automation
              </Cell>
              <Cell to="/end-user-guide/workflow-automation" title="Workflow Automation" icon={<IconChecklist />}>
                Mattermost Playbooks for automating SOPs
              </Cell>
              <Cell to="/end-user-guide/collaborate/audio-and-screensharing" title="Audio & Screenshare" icon={<IconCall />}>
                Mattermost Calls for real‑time calling and screenshare
              </Cell>
              <Cell to="/end-user-guide/project-task-management" title="Project Tracking" icon={<IconTarget />}>
                Mattermost Boards for Kanban and work management
              </Cell>
              <Cell to="/end-user-guide/agents" title="AI Agents & Open APIs" icon={<IconSparkles />}>
                Mattermost Agents — AI assistance and integration
              </Cell>
            </div>
          </div>
          <div className={styles.appFooter}>
            <Link to="/end-user-guide/access/access-your-workspace" className={styles.footerCell}>
              <span className={styles.footerIcon}><IconDevices /></span>
              Desktop, web, mobile &amp; Microsoft&nbsp;Teams clients
            </Link>
            <Link to="/developers" className={styles.footerCell}>
              <span className={styles.footerIcon}><IconCode /></span>
              Extensible open-source architecture
            </Link>
          </div>
        </div>
      </div>

      {/* INTEGRATION */}
      <div className={`${styles.layer} ${styles.layerIntegration}`}>
        <div className={styles.layerLabel}>Integration</div>
        <div className={styles.layerBody}>
          <div className={styles.intGrid}>
            <div className={styles.intIntro}>
              <h3><span className={styles.introIcon}><IconPlug /></span>Integration & AI Platform</h3>
              <p>
                Operational extensibility with pre-packaged, source-available connectors,
                automations, and templates for rapid and effective systems integration.
              </p>
            </div>
            <Cell to="/integrations-guide/integrations-guide-index" title="Layered Extensibility" icon={<IconCode />}>
              <ul>
                <li>Pre-packaged and custom integrations</li>
                <li>Webhooks and slash commands</li>
                <li>Plugin architecture</li>
              </ul>
            </Cell>
            <Cell to="/end-user-guide/agents" title="Multi-Agent / Multi-LLM Integration" icon={<IconSparkles />}>
              <ul>
                <li>Sovereign AI model support via OpenAI APIs</li>
                <li>Custom instructions, RAG, semantic search</li>
                <li>Responsible AI control plane</li>
                <li>MCP and agent-to-agent architecture</li>
              </ul>
            </Cell>
          </div>
          <div className={styles.appFooter}>
            <Link to="/integrations-guide/integrations-guide-index" className={styles.footerCell}>
              <span className={styles.footerIcon}><IconVideo /></span>
              Video meetings: Pexip · Webex · Cisco
            </Link>
            <Link to="/integrations-guide/integrations-guide-index" className={styles.footerCell}>
              <span className={styles.footerIcon}><IconPlug /></span>
              Pre-built: GitHub · GitLab · Jira · ServiceNow · M365
            </Link>
          </div>
        </div>
      </div>

      {/* DEPLOYMENT */}
      <div className={`${styles.layer} ${styles.layerDeployment}`}>
        <div className={styles.layerLabel}>Deployment</div>
        <div className={styles.layerBody}>
          <div className={styles.depGrid}>
            <div className={styles.depIntro}>
              <h3><span className={styles.introIcon}><IconGlobe /></span>Sovereign, Cyber‑Resilient Deployment</h3>
              <p>
                Kubernetes-based orchestration on private, government, and air-gapped clouds.
                Scales from tactical edge to strategic core with geo-distributed ultra-high
                availability.
              </p>
            </div>
            <Cell to="/deployment-guide/reference-architecture/reference-architecture-index" title="Tactical Edge to Strategic Core" icon={<IconServer />}>
              Runs at the edge, in your data center, in sovereign clouds, and on global hyperscalers: Azure, AWS, Google Cloud, Oracle Cloud.
            </Cell>
            <Cell to="/for/air-gapped-operator" title="Mission-Ready Security & Resilience" icon={<IconShield />}>
              <ul>
                <li>Classified, air-gapped, and DDIL operations</li>
                <li>Defense-grade controls, monitoring, and mobile security</li>
                <li>Scales to 200K+ users</li>
              </ul>
            </Cell>
          </div>
        </div>
      </div>
    </section>
  );
}
