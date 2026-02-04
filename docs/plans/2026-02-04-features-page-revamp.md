# Mattermost Extended Features Page Revamp

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the flat feature flags list into a visually stunning, sectioned page with icons, major feature highlighting, and collapsible sections.

**Architecture:** Replace the thin wrapper `mattermost_extended_features.tsx` with a full standalone component. Define feature metadata with sections, icons, and importance levels. Render features grouped by section with major features prominently displayed at the top of each section. Keep `feature_flags.tsx` unchanged for upstream compatibility.

**Tech Stack:** React, styled-components, @mattermost/compass-icons

---

## Feature Categorization

### Sections & Their Features

| Section | Icon | Features |
|---------|------|----------|
| **Security & Privacy** | `LockOutlineIcon` | Encryption* |
| **Messaging** | `MessageTextOutlineIcon` | ThreadsInSidebar*, DiscordReplies*, CustomThreadNames |
| **Media & Embeds** | `ImageOutlineIcon` | ImageMulti, ImageSmaller, ImageCaptions, VideoEmbed, VideoLinkEmbed, EmbedYoutube |
| **User Experience** | `PaletteOutlineIcon` | CustomChannelIcons*, GuildedSounds*, SettingsResorted, HideUpdateStatusButton, FreeSidebarResizing |
| **Status & Activity** | `ClockOutlineIcon` | AccurateStatuses*, NoOffline |
| **System Console** | `CogOutlineIcon` | ErrorLogDashboard, SystemConsoleDarkMode, SystemConsoleHideEnterprise, SystemConsoleIcons, SuppressEnterpriseUpgradeChecks |
| **Preferences** | `TuneIcon` | PreferencesRevamp, PreferenceOverridesDashboard |

\* = Major Feature (gets special visual treatment)

### Major Features (7 total)
1. **Encryption** - End-to-end encryption
2. **ThreadsInSidebar** - Threads under channels
3. **DiscordReplies** - Inline reply previews
4. **CustomChannelIcons** - Custom sidebar icons
5. **GuildedSounds** - Chat sounds
6. **AccurateStatuses** - Heartbeat-based status tracking

---

## Task 1: Define Feature Metadata Structure

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`

**Step 1: Add icon imports**

Add at the top of the file after existing imports:

```typescript
import {
    LockOutlineIcon,
    MessageTextOutlineIcon,
    ImageOutlineIcon,
    PaletteOutlineIcon,
    ClockOutlineIcon,
    CogOutlineIcon,
    TuneIcon,
    ForumOutlineIcon,
    BellRingOutlineIcon,
    AlertCircleOutlineIcon,
    EyeOffOutlineIcon,
    ArrowExpandHorizontalIcon,
    PlayBoxOutlineIcon,
    YoutubeIcon,
    LinkVariantIcon,
    ShieldOutlineIcon,
} from '@mattermost/compass-icons/components';
```

**Step 2: Define section and feature types**

Add after imports:

```typescript
type SectionId = 'security' | 'messaging' | 'media' | 'ux' | 'status' | 'system' | 'preferences';

interface SectionDefinition {
    id: SectionId;
    title: string;
    icon: React.ReactNode;
    description: string;
}

interface FeatureDefinition {
    key: string;
    title: string;
    description: string;
    defaultValue: boolean;
    section: SectionId;
    icon: React.ReactNode;
    isMajor: boolean;
}
```

**Step 3: Define sections array**

```typescript
const SECTIONS: SectionDefinition[] = [
    {
        id: 'security',
        title: 'Security & Privacy',
        icon: <LockOutlineIcon size={20}/>,
        description: 'Encryption and privacy features',
    },
    {
        id: 'messaging',
        title: 'Messaging',
        icon: <MessageTextOutlineIcon size={20}/>,
        description: 'Thread and reply enhancements',
    },
    {
        id: 'media',
        title: 'Media & Embeds',
        icon: <ImageOutlineIcon size={20}/>,
        description: 'Image, video, and embed handling',
    },
    {
        id: 'ux',
        title: 'User Experience',
        icon: <PaletteOutlineIcon size={20}/>,
        description: 'Visual and interaction improvements',
    },
    {
        id: 'status',
        title: 'Status & Activity',
        icon: <ClockOutlineIcon size={20}/>,
        description: 'User presence and activity tracking',
    },
    {
        id: 'system',
        title: 'System Console',
        icon: <CogOutlineIcon size={20}/>,
        description: 'Admin console customizations',
    },
    {
        id: 'preferences',
        title: 'Preferences',
        icon: <TuneIcon size={20}/>,
        description: 'User preference management',
    },
];
```

**Step 4: Define all features with metadata**

```typescript
const FEATURES: FeatureDefinition[] = [
    // Security & Privacy
    {
        key: 'Encryption',
        title: 'End-to-End Encryption',
        description: 'RSA-OAEP + AES-GCM hybrid encryption for messages. Encrypted content shows purple styling with lock icon.',
        defaultValue: false,
        section: 'security',
        icon: <LockOutlineIcon size={18}/>,
        isMajor: true,
    },

    // Messaging
    {
        key: 'ThreadsInSidebar',
        title: 'Threads in Sidebar',
        description: 'Display followed threads nested under their parent channels instead of only in Threads view.',
        defaultValue: false,
        section: 'messaging',
        icon: <MessageTextOutlineIcon size={18}/>,
        isMajor: true,
    },
    {
        key: 'DiscordReplies',
        title: 'Discord-Style Replies',
        description: 'Inline reply previews with curved connector lines. Click Reply to queue posts, then send.',
        defaultValue: false,
        section: 'messaging',
        icon: <ForumOutlineIcon size={18}/>,
        isMajor: true,
    },
    {
        key: 'CustomThreadNames',
        title: 'Custom Thread Names',
        description: 'Allow users to rename threads from the thread header.',
        defaultValue: false,
        section: 'messaging',
        icon: <MessageTextOutlineIcon size={18}/>,
        isMajor: false,
    },

    // Media & Embeds
    {
        key: 'ImageMulti',
        title: 'Full-Size Multiple Images',
        description: 'Display multiple images at full size instead of thumbnails.',
        defaultValue: false,
        section: 'media',
        icon: <ImageOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'ImageSmaller',
        title: 'Image Size Constraints',
        description: 'Enforce max height/width on images. Configure limits in Media settings.',
        defaultValue: false,
        section: 'media',
        icon: <ImageOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'ImageCaptions',
        title: 'Image Captions',
        description: 'Show captions below markdown images from title attribute.',
        defaultValue: false,
        section: 'media',
        icon: <ImageOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'VideoEmbed',
        title: 'Video Attachments',
        description: 'Inline video players for video file attachments.',
        defaultValue: false,
        section: 'media',
        icon: <PlayBoxOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'VideoLinkEmbed',
        title: 'Video Link Embeds',
        description: 'Embed video players for links with [▶️Video](url) format.',
        defaultValue: false,
        section: 'media',
        icon: <LinkVariantIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'EmbedYoutube',
        title: 'YouTube Embeds',
        description: 'Discord-style YouTube embeds with card layout and red accent bar.',
        defaultValue: false,
        section: 'media',
        icon: <YoutubeIcon size={18}/>,
        isMajor: false,
    },

    // User Experience
    {
        key: 'CustomChannelIcons',
        title: 'Custom Channel Icons',
        description: 'Set custom icons for channels from 7000+ Material Design icons.',
        defaultValue: false,
        section: 'ux',
        icon: <PaletteOutlineIcon size={18}/>,
        isMajor: true,
    },
    {
        key: 'GuildedSounds',
        title: 'Chat Sounds',
        description: 'Guilded-style sound effects for messages and reactions with volume control.',
        defaultValue: false,
        section: 'ux',
        icon: <BellRingOutlineIcon size={18}/>,
        isMajor: true,
    },
    {
        key: 'SettingsResorted',
        title: 'Reorganized Settings',
        description: 'User settings reorganized into intuitive categories with icons.',
        defaultValue: false,
        section: 'ux',
        icon: <TuneIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'HideUpdateStatusButton',
        title: 'Hide Status Button',
        description: 'Hide "Update your status" button on posts when no custom status is set.',
        defaultValue: false,
        section: 'ux',
        icon: <EyeOffOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'FreeSidebarResizing',
        title: 'Free Sidebar Resizing',
        description: 'Resize sidebars freely without max-width constraints. Persists across sessions.',
        defaultValue: false,
        section: 'ux',
        icon: <ArrowExpandHorizontalIcon size={18}/>,
        isMajor: false,
    },

    // Status & Activity
    {
        key: 'AccurateStatuses',
        title: 'Accurate Status Tracking',
        description: 'Heartbeat-based LastActivityAt tracking. Sets Away after inactivity timeout.',
        defaultValue: false,
        section: 'status',
        icon: <ClockOutlineIcon size={18}/>,
        isMajor: true,
    },
    {
        key: 'NoOffline',
        title: 'Prevent Offline Status',
        description: 'Keep active users from showing as offline. Hides Offline option from status menu.',
        defaultValue: false,
        section: 'status',
        icon: <ClockOutlineIcon size={18}/>,
        isMajor: false,
    },

    // System Console
    {
        key: 'ErrorLogDashboard',
        title: 'Error Log Dashboard',
        description: 'Real-time API and JavaScript error monitoring for admins.',
        defaultValue: false,
        section: 'system',
        icon: <AlertCircleOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'SystemConsoleDarkMode',
        title: 'Dark Mode',
        description: 'Apply dark mode to System Console using CSS filters.',
        defaultValue: true,
        section: 'system',
        icon: <CogOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'SystemConsoleHideEnterprise',
        title: 'Hide Enterprise Features',
        description: 'Hide enterprise-only features that require a license.',
        defaultValue: false,
        section: 'system',
        icon: <ShieldOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'SystemConsoleIcons',
        title: 'Sidebar Icons',
        description: 'Show icons next to subsections in System Console sidebar.',
        defaultValue: false,
        section: 'system',
        icon: <CogOutlineIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'SuppressEnterpriseUpgradeChecks',
        title: 'Suppress Upgrade Checks',
        description: 'Suppress enterprise upgrade API calls that spam 403 errors.',
        defaultValue: true,
        section: 'system',
        icon: <ShieldOutlineIcon size={18}/>,
        isMajor: false,
    },

    // Preferences
    {
        key: 'PreferencesRevamp',
        title: 'Preferences Revamp',
        description: 'Refactor preferences to use shared definitions. Required for Preference Overrides.',
        defaultValue: false,
        section: 'preferences',
        icon: <TuneIcon size={18}/>,
        isMajor: false,
    },
    {
        key: 'PreferenceOverridesDashboard',
        title: 'Admin Preference Overrides',
        description: 'Dashboard to enforce user preferences server-wide. Requires Preferences Revamp.',
        defaultValue: false,
        section: 'preferences',
        icon: <TuneIcon size={18}/>,
        isMajor: false,
    },
];
```

**Step 5: Commit**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git commit -m "feat(admin): define feature metadata with sections and icons"
```

---

## Task 2: Create Styled Components for Sectioned Layout

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`

**Step 1: Add styled-components import**

```typescript
import styled from 'styled-components';
```

**Step 2: Create container and layout components**

Add after the FEATURES array:

```typescript
const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

const ContentWrapper = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 0 32px 32px;
`;

const HeaderBanner = styled.div`
    margin-bottom: 24px;
`;

const StatsBar = styled.div`
    display: flex;
    gap: 24px;
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(var(--button-bg-rgb), 0.08) 0%, rgba(var(--button-bg-rgb), 0.04) 100%);
    border-radius: 12px;
    margin-bottom: 32px;
    border: 1px solid rgba(var(--button-bg-rgb), 0.12);
`;

const StatItem = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;

    .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--button-bg);
    }

    .stat-label {
        font-size: 12px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
`;

const SearchRow = styled.div`
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
`;

const SearchInput = styled.input`
    flex: 1;
    max-width: 400px;
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 8px;
    font-size: 14px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);

    &:focus {
        outline: none;
        border-color: var(--button-bg);
        box-shadow: 0 0 0 3px rgba(var(--button-bg-rgb), 0.12);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;
```

**Step 3: Create section components**

```typescript
const Section = styled.div`
    margin-bottom: 32px;
`;

const SectionHeader = styled.div<{isCollapsed: boolean}>`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 12px;
    margin-bottom: ${({isCollapsed}) => isCollapsed ? '0' : '16px'};
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const SectionIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--button-bg);
    color: var(--button-color);
`;

const SectionInfo = styled.div`
    flex: 1;
`;

const SectionTitle = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
`;

const SectionDescription = styled.div`
    font-size: 13px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const SectionStats = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
`;

const SectionBadge = styled.span<{variant: 'enabled' | 'total'}>`
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    background: ${({variant}) => variant === 'enabled'
        ? 'rgba(61, 204, 145, 0.15)'
        : 'rgba(var(--center-channel-color-rgb), 0.08)'};
    color: ${({variant}) => variant === 'enabled'
        ? 'var(--online-indicator)'
        : 'rgba(var(--center-channel-color-rgb), 0.64)'};
`;

const CollapseIcon = styled.div<{isCollapsed: boolean}>`
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    transform: ${({isCollapsed}) => isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
    transition: transform 0.2s ease;
`;

const SectionContent = styled.div<{isCollapsed: boolean}>`
    display: ${({isCollapsed}) => isCollapsed ? 'none' : 'flex'};
    flex-direction: column;
    gap: 12px;
`;
```

**Step 4: Commit**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git commit -m "feat(admin): add styled components for sectioned layout"
```

---

## Task 3: Create Feature Card Components

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`

**Step 1: Create major feature card**

```typescript
const MajorFeatureCard = styled.div<{isEnabled: boolean}>`
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 24px;
    background: ${({isEnabled}) => isEnabled
        ? 'linear-gradient(135deg, rgba(61, 204, 145, 0.08) 0%, rgba(61, 204, 145, 0.04) 100%)'
        : 'var(--center-channel-bg)'};
    border: 2px solid ${({isEnabled}) => isEnabled
        ? 'rgba(61, 204, 145, 0.24)'
        : 'rgba(var(--center-channel-color-rgb), 0.08)'};
    border-radius: 12px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: ${({isEnabled}) => isEnabled ? 'var(--online-indicator)' : 'transparent'};
    }

    &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        border-color: ${({isEnabled}) => isEnabled
            ? 'rgba(61, 204, 145, 0.4)'
            : 'rgba(var(--center-channel-color-rgb), 0.16)'};
    }
`;

const FeatureIcon = styled.div<{isEnabled: boolean; isMajor: boolean}>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${({isMajor}) => isMajor ? '48px' : '36px'};
    height: ${({isMajor}) => isMajor ? '48px' : '36px'};
    border-radius: ${({isMajor}) => isMajor ? '12px' : '8px'};
    background: ${({isEnabled, isMajor}) => isEnabled
        ? (isMajor ? 'var(--online-indicator)' : 'rgba(61, 204, 145, 0.15)')
        : 'rgba(var(--center-channel-color-rgb), 0.08)'};
    color: ${({isEnabled, isMajor}) => isEnabled
        ? (isMajor ? 'white' : 'var(--online-indicator)')
        : 'rgba(var(--center-channel-color-rgb), 0.48)'};
    flex-shrink: 0;
    transition: all 0.2s ease;
`;

const FeatureInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const FeatureHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
`;

const FeatureTitle = styled.div<{isMajor: boolean}>`
    font-size: ${({isMajor}) => isMajor ? '16px' : '14px'};
    font-weight: 600;
    color: var(--center-channel-color);
`;

const MajorBadge = styled.span`
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, var(--button-bg) 0%, rgba(var(--button-bg-rgb), 0.8) 100%);
    color: var(--button-color);
`;

const FeatureDescription = styled.div`
    font-size: 13px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    line-height: 1.5;
`;

const FeatureKey = styled.div`
    font-size: 11px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    margin-top: 8px;
`;
```

**Step 2: Create regular feature card**

```typescript
const RegularFeatureCard = styled.div<{isEnabled: boolean}>`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: ${({isEnabled}) => isEnabled
        ? 'rgba(61, 204, 145, 0.04)'
        : 'var(--center-channel-bg)'};
    border: 1px solid ${({isEnabled}) => isEnabled
        ? 'rgba(61, 204, 145, 0.16)'
        : 'rgba(var(--center-channel-color-rgb), 0.08)'};
    border-radius: 8px;
    transition: all 0.15s ease;

    &:hover {
        background: ${({isEnabled}) => isEnabled
            ? 'rgba(61, 204, 145, 0.08)'
            : 'rgba(var(--center-channel-color-rgb), 0.04)'};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
`;
```

**Step 3: Create toggle switch**

```typescript
const ToggleSwitch = styled.label`
    position: relative;
    display: inline-block;
    width: 48px;
    height: 28px;
    flex-shrink: 0;
`;

const ToggleSlider = styled.span<{checked: boolean; disabled?: boolean}>`
    position: absolute;
    cursor: ${({disabled}) => disabled ? 'not-allowed' : 'pointer'};
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${({checked}) => checked ? 'var(--online-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.24)'};
    transition: 0.2s;
    border-radius: 28px;
    opacity: ${({disabled}) => disabled ? 0.5 : 1};

    &:before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: ${({checked}) => checked ? '23px' : '3px'};
        bottom: 3px;
        background-color: white;
        transition: 0.2s;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
`;

const HiddenCheckbox = styled.input`
    opacity: 0;
    width: 0;
    height: 0;
`;

const UnsavedIndicator = styled.span`
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #FFA500;
    margin-left: 8px;
`;
```

**Step 4: Create save container**

```typescript
const SaveContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 32px;
    background: var(--center-channel-bg);
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const NoResults = styled.div`
    text-align: center;
    padding: 48px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 14px;
`;
```

**Step 5: Commit**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git commit -m "feat(admin): add feature card styled components"
```

---

## Task 4: Implement Component Logic

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`

**Step 1: Add necessary imports**

At the top, update React imports:

```typescript
import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import styled from 'styled-components';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import FormError from 'components/form_error';

import {
    ChevronDownIcon,
} from '@mattermost/compass-icons/components';
```

**Step 2: Add helper function**

```typescript
function toBool(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true';
    }
    return false;
}
```

**Step 3: Implement the component**

Replace the existing component with:

```typescript
const MattermostExtendedFeatures: React.FC<Props> = ({config, patchConfig, disabled = false}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(new Set());
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Build feature lookup for quick access
    const featuresByKey = useMemo(() => {
        const map: Record<string, FeatureDefinition> = {};
        for (const feature of FEATURES) {
            map[feature.key] = feature;
        }
        return map;
    }, []);

    // Initialize local flags from config
    const initialFlags = useMemo(() => {
        const flags: Record<string, boolean> = {};
        for (const feature of FEATURES) {
            flags[feature.key] = feature.defaultValue;
        }
        if (config.FeatureFlags) {
            for (const [key, value] of Object.entries(config.FeatureFlags)) {
                if (featuresByKey[key]) {
                    flags[key] = toBool(value);
                }
            }
        }
        return flags;
    }, [config.FeatureFlags, featuresByKey]);

    const [localFlags, setLocalFlags] = useState<Record<string, boolean>>(initialFlags);

    useEffect(() => {
        setLocalFlags(initialFlags);
    }, [initialFlags]);

    // Track changes
    const changedFlags = useMemo(() => {
        const changed: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(localFlags)) {
            if (initialFlags[key] !== value) {
                changed[key] = value;
            }
        }
        return changed;
    }, [localFlags, initialFlags]);

    const saveNeeded = Object.keys(changedFlags).length > 0;

    // Filter features by search
    const filteredFeatures = useMemo(() => {
        if (!searchTerm) {
            return FEATURES;
        }
        const term = searchTerm.toLowerCase();
        return FEATURES.filter((f) =>
            f.title.toLowerCase().includes(term) ||
            f.description.toLowerCase().includes(term) ||
            f.key.toLowerCase().includes(term)
        );
    }, [searchTerm]);

    // Group features by section
    const featuresBySection = useMemo(() => {
        const grouped: Record<SectionId, FeatureDefinition[]> = {
            security: [],
            messaging: [],
            media: [],
            ux: [],
            status: [],
            system: [],
            preferences: [],
        };
        for (const feature of filteredFeatures) {
            grouped[feature.section].push(feature);
        }
        // Sort each section: major first, then alphabetically
        for (const section of Object.keys(grouped) as SectionId[]) {
            grouped[section].sort((a, b) => {
                if (a.isMajor && !b.isMajor) return -1;
                if (!a.isMajor && b.isMajor) return 1;
                return a.title.localeCompare(b.title);
            });
        }
        return grouped;
    }, [filteredFeatures]);

    // Stats
    const stats = useMemo(() => {
        const total = FEATURES.length;
        const enabled = FEATURES.filter((f) => localFlags[f.key]).length;
        const majorEnabled = FEATURES.filter((f) => f.isMajor && localFlags[f.key]).length;
        const majorTotal = FEATURES.filter((f) => f.isMajor).length;
        return {total, enabled, majorEnabled, majorTotal};
    }, [localFlags]);

    const handleToggle = useCallback((key: string, newValue: boolean) => {
        setLocalFlags((prev) => ({...prev, [key]: newValue}));
        setServerError(null);
    }, []);

    const toggleSection = useCallback((sectionId: SectionId) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    const handleSave = useCallback(async () => {
        if (!saveNeeded) return;
        setSaving(true);
        setServerError(null);

        try {
            // Get all existing feature flags and merge our changes
            const allFlags: Record<string, boolean> = {};
            if (config.FeatureFlags) {
                for (const [key, value] of Object.entries(config.FeatureFlags)) {
                    if (key !== 'TestFeature') {
                        allFlags[key] = toBool(value);
                    }
                }
            }
            // Apply our local changes
            for (const [key, value] of Object.entries(localFlags)) {
                allFlags[key] = value;
            }

            const result = await patchConfig({
                FeatureFlags: allFlags,
            });

            if (result.error) {
                setServerError(result.error.message || 'Failed to save');
            }
        } catch (err: unknown) {
            setServerError(err instanceof Error ? err.message : 'Unexpected error');
        } finally {
            setSaving(false);
        }
    }, [saveNeeded, config.FeatureFlags, localFlags, patchConfig]);

    const renderFeatureCard = (feature: FeatureDefinition) => {
        const isEnabled = localFlags[feature.key];
        const isModified = initialFlags[feature.key] !== isEnabled;

        if (feature.isMajor) {
            return (
                <MajorFeatureCard key={feature.key} isEnabled={isEnabled}>
                    <FeatureIcon isEnabled={isEnabled} isMajor={true}>
                        {feature.icon}
                    </FeatureIcon>
                    <FeatureInfo>
                        <FeatureHeader>
                            <FeatureTitle isMajor={true}>
                                {feature.title}
                                {isModified && <UnsavedIndicator title="Unsaved change"/>}
                            </FeatureTitle>
                            <MajorBadge>Major</MajorBadge>
                        </FeatureHeader>
                        <FeatureDescription>{feature.description}</FeatureDescription>
                        <FeatureKey>{feature.key}</FeatureKey>
                    </FeatureInfo>
                    <ToggleSwitch>
                        <HiddenCheckbox
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => handleToggle(feature.key, e.target.checked)}
                            disabled={disabled}
                        />
                        <ToggleSlider checked={isEnabled} disabled={disabled}/>
                    </ToggleSwitch>
                </MajorFeatureCard>
            );
        }

        return (
            <RegularFeatureCard key={feature.key} isEnabled={isEnabled}>
                <FeatureIcon isEnabled={isEnabled} isMajor={false}>
                    {feature.icon}
                </FeatureIcon>
                <FeatureInfo>
                    <FeatureHeader>
                        <FeatureTitle isMajor={false}>
                            {feature.title}
                            {isModified && <UnsavedIndicator title="Unsaved change"/>}
                        </FeatureTitle>
                    </FeatureHeader>
                    <FeatureDescription>{feature.description}</FeatureDescription>
                </FeatureInfo>
                <ToggleSwitch>
                    <HiddenCheckbox
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => handleToggle(feature.key, e.target.checked)}
                        disabled={disabled}
                    />
                    <ToggleSlider checked={isEnabled} disabled={disabled}/>
                </ToggleSwitch>
            </RegularFeatureCard>
        );
    };

    const renderSection = (section: SectionDefinition) => {
        const features = featuresBySection[section.id];
        if (features.length === 0) return null;

        const isCollapsed = collapsedSections.has(section.id);
        const enabledCount = features.filter((f) => localFlags[f.key]).length;

        return (
            <Section key={section.id}>
                <SectionHeader
                    isCollapsed={isCollapsed}
                    onClick={() => toggleSection(section.id)}
                >
                    <SectionIcon>{section.icon}</SectionIcon>
                    <SectionInfo>
                        <SectionTitle>{section.title}</SectionTitle>
                        <SectionDescription>{section.description}</SectionDescription>
                    </SectionInfo>
                    <SectionStats>
                        <SectionBadge variant="enabled">{enabledCount} enabled</SectionBadge>
                        <SectionBadge variant="total">{features.length} total</SectionBadge>
                    </SectionStats>
                    <CollapseIcon isCollapsed={isCollapsed}>
                        <ChevronDownIcon size={20}/>
                    </CollapseIcon>
                </SectionHeader>
                <SectionContent isCollapsed={isCollapsed}>
                    {features.map(renderFeatureCard)}
                </SectionContent>
            </Section>
        );
    };

    return (
        <Container className="wrapper--admin">
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>

            <ContentWrapper>
                <HeaderBanner>
                    <div className="banner info">
                        <div className="banner__content">
                            <FormattedMessage
                                id="admin.mattermost_extended.features.introBanner"
                                defaultMessage="Toggle Mattermost Extended features on or off. Changes take effect after saving."
                            />
                        </div>
                    </div>
                </HeaderBanner>

                <StatsBar>
                    <StatItem>
                        <span className="stat-value">{stats.majorEnabled}/{stats.majorTotal}</span>
                        <span className="stat-label">Major Features</span>
                    </StatItem>
                    <StatItem>
                        <span className="stat-value">{stats.enabled}</span>
                        <span className="stat-label">Enabled</span>
                    </StatItem>
                    <StatItem>
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                    </StatItem>
                    <StatItem>
                        <span className="stat-value">{Object.keys(changedFlags).length}</span>
                        <span className="stat-label">Unsaved</span>
                    </StatItem>
                </StatsBar>

                <SearchRow>
                    <SearchInput
                        type="text"
                        placeholder="Search features..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </SearchRow>

                {filteredFeatures.length === 0 ? (
                    <NoResults>
                        <FormattedMessage
                            id="admin.mattermost_extended.features.noResults"
                            defaultMessage="No features match your search"
                        />
                    </NoResults>
                ) : (
                    SECTIONS.map(renderSection)
                )}
            </ContentWrapper>

            <SaveContainer>
                <SaveButton
                    saving={saving}
                    disabled={disabled || !saveNeeded}
                    onClick={handleSave}
                    savingMessage={
                        <FormattedMessage
                            id="admin.saving"
                            defaultMessage="Saving Config..."
                        />
                    }
                />
                {serverError && <FormError error={serverError}/>}
            </SaveContainer>
        </Container>
    );
};
```

**Step 4: Commit**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git commit -m "feat(admin): implement sectioned features component with icons"
```

---

## Task 5: Final Assembly and Cleanup

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`

**Step 1: Verify complete file structure**

The final file should have this structure:
1. Copyright header
2. Imports (React, styled-components, compass-icons, etc.)
3. Type definitions (SectionId, SectionDefinition, FeatureDefinition, Props)
4. SECTIONS array
5. FEATURES array
6. Styled components (all 25+ components)
7. Helper function (toBool)
8. Main component (MattermostExtendedFeatures)
9. Export

**Step 2: Remove the FeatureFlags import**

Since we're no longer using the generic FeatureFlags component, remove:

```typescript
// REMOVE THIS LINE:
import FeatureFlags from './feature_flags';
```

**Step 3: Verify all icon imports exist**

Check that all icons used are available. Run the webapp build to verify:

```bash
cd webapp && npm run build:check
```

Expected: Build succeeds with no missing import errors.

**Step 4: Commit final version**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git commit -m "feat(admin): complete Mattermost Extended Features page revamp"
```

---

## Task 6: Visual Testing

**Step 1: Build and start local server**

```bash
./local-test.ps1 build
./local-test.ps1 start
```

**Step 2: Navigate to features page**

Open: `http://localhost:8065/admin_console/mattermost_extended/features`

**Step 3: Verify visual elements**

Check:
- [ ] All 7 sections appear with correct icons
- [ ] Major features have larger cards with "MAJOR" badge
- [ ] Regular features have compact cards
- [ ] Section collapse/expand works
- [ ] Search filters features across all sections
- [ ] Toggle switches work
- [ ] Unsaved indicator (orange dot) appears on changed features
- [ ] Stats bar shows correct counts
- [ ] Save button enables when changes are made
- [ ] Changes persist after save

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(admin): address visual testing feedback"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Define metadata structure | `mattermost_extended_features.tsx` |
| 2 | Create section styled components | `mattermost_extended_features.tsx` |
| 3 | Create feature card components | `mattermost_extended_features.tsx` |
| 4 | Implement component logic | `mattermost_extended_features.tsx` |
| 5 | Final assembly and cleanup | `mattermost_extended_features.tsx` |
| 6 | Visual testing | N/A |

**Total estimated commits:** 6
