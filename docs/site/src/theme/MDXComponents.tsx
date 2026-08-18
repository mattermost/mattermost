// Globally-available MDX components. Authors can write <Note>...</Note>
// in any .mdx file without an import.

import MDXComponents from '@theme-original/MDXComponents';
import {Note, Tip, Important, Warning, Security} from '@site/src/components/Callout';
import PlanBadge from '@site/src/components/PlanBadge';
import PlanAvailability from '@site/src/components/PlanAvailability';
import EditionAvailability from '@site/src/components/EditionAvailability';
import DeploymentAvailability from '@site/src/components/DeploymentAvailability';
import AttestationStatus from '@site/src/components/AttestationStatus';
import DeploymentOnly from '@site/src/components/DeploymentOnly';
import IMEDiagram from '@site/src/components/IMEDiagram';
import DeploymentArchitectureBuilder from '@site/src/components/DeploymentArchitectureBuilder';
import CompassIcon from '@site/src/components/CompassIcon';
import Hero from '@site/src/components/Hero';
import Eyebrow from '@site/src/components/Eyebrow';
import StatStrip from '@site/src/components/StatStrip';
import MethodLegend from '@site/src/components/MethodLegend';
import CardGrid from '@site/src/components/CardGrid';
import UpgradeNotesFilter from '@site/src/components/UpgradeNotesFilter';
// Globally available so migrated developer docs (Hugo `tabs` shortcode)
// can use them without imports.
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

export default {
  ...MDXComponents,
  Note,
  Tip,
  Important,
  Warning,
  Security,
  PlanBadge,
  PlanAvailability,
  EditionAvailability,
  DeploymentAvailability,
  AttestationStatus,
  DeploymentOnly,
  IMEDiagram,
  DeploymentArchitectureBuilder,
  CompassIcon,
  Hero,
  Eyebrow,
  StatStrip,
  MethodLegend,
  CardGrid,
  UpgradeNotesFilter,
  Tabs,
  TabItem,
};
