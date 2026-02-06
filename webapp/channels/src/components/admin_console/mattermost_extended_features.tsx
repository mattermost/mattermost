// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import styled, {css} from 'styled-components';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import FormError from 'components/form_error';

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
    PlayOutlineIcon,
    VideoOutlineIcon,
    LinkVariantIcon,
    ShieldOutlineIcon,
    ChevronDownIcon,
    ViewGridPlusOutlineIcon,
} from '@mattermost/compass-icons/components';

export const messages = defineMessages({
    title: {id: 'admin.mattermost_extended.features.title', defaultMessage: 'Features'},
});

type SectionId = 'security' | 'messaging' | 'media' | 'layout' | 'ux' | 'status' | 'system' | 'preferences';

interface SectionDefinition {
    id: SectionId;
    title: string;
    icon: React.ElementType;
    description: string;
}

interface FeatureDefinition {
    key: string;
    title: string;
    description: string;
    defaultValue: boolean;
    section: SectionId;
    icon: React.ElementType;
    isMajor: boolean;
}

const SECTIONS: SectionDefinition[] = [
    {
        id: 'security',
        title: 'Security & Privacy',
        icon: LockOutlineIcon,
        description: 'Encryption and privacy features',
    },
    {
        id: 'messaging',
        title: 'Messaging',
        icon: MessageTextOutlineIcon,
        description: 'Thread and reply enhancements',
    },
    {
        id: 'media',
        title: 'Media & Embeds',
        icon: ImageOutlineIcon,
        description: 'Image, video, and embed handling',
    },
    {
        id: 'layout',
        title: 'Layout & Navigation',
        icon: ViewGridPlusOutlineIcon,
        description: 'Chat layout and sidebar enhancements',
    },
    {
        id: 'ux',
        title: 'User Experience',
        icon: PaletteOutlineIcon,
        description: 'Visual and interaction improvements',
    },
    {
        id: 'status',
        title: 'Status & Activity',
        icon: ClockOutlineIcon,
        description: 'User presence and activity tracking',
    },
    {
        id: 'system',
        title: 'System Console',
        icon: CogOutlineIcon,
        description: 'Admin console customizations',
    },
    {
        id: 'preferences',
        title: 'Preferences',
        icon: TuneIcon,
        description: 'User preference management',
    },
];

const FEATURES: FeatureDefinition[] = [
    // Security & Privacy
    {
        key: 'Encryption',
        title: 'End-to-End Encryption',
        description: 'RSA-OAEP + AES-GCM hybrid encryption for messages. Encrypted content shows purple styling with lock icon.',
        defaultValue: false,
        section: 'security',
        icon: LockOutlineIcon,
        isMajor: true,
    },

    // Layout & Navigation
    {
        key: 'GuildedChatLayout',
        title: 'Guilded Chat Layout',
        description: 'Guilded-style UI: enhanced team sidebar with DM button, separate DM page, persistent Members/Threads RHS, modal popouts. Auto-enables ThreadsInSidebar. Desktop only (≥768px).',
        defaultValue: false,
        section: 'layout',
        icon: ViewGridPlusOutlineIcon,
        isMajor: true,
    },

    // Messaging
    {
        key: 'ThreadsInSidebar',
        title: 'Threads in Sidebar',
        description: 'Display followed threads nested under their parent channels instead of only in Threads view.',
        defaultValue: false,
        section: 'messaging',
        icon: MessageTextOutlineIcon,
        isMajor: true,
    },
    {
        key: 'DiscordReplies',
        title: 'Discord-Style Replies',
        description: 'Inline reply previews with curved connector lines. Click Reply to queue posts, then send.',
        defaultValue: false,
        section: 'messaging',
        icon: ForumOutlineIcon,
        isMajor: true,
    },
    {
        key: 'CustomThreadNames',
        title: 'Custom Thread Names',
        description: 'Allow users to rename threads from the thread header.',
        defaultValue: false,
        section: 'messaging',
        icon: MessageTextOutlineIcon,
        isMajor: false,
    },

    // Media & Embeds
    {
        key: 'ImageMulti',
        title: 'Full-Size Multiple Images',
        description: 'Display multiple images at full size instead of thumbnails.',
        defaultValue: false,
        section: 'media',
        icon: ImageOutlineIcon,
        isMajor: false,
    },
    {
        key: 'ImageSmaller',
        title: 'Image Size Constraints',
        description: 'Enforce max height/width on images. Configure limits in Media settings.',
        defaultValue: false,
        section: 'media',
        icon: ImageOutlineIcon,
        isMajor: false,
    },
    {
        key: 'ImageCaptions',
        title: 'Image Captions',
        description: 'Show captions below markdown images from title attribute.',
        defaultValue: false,
        section: 'media',
        icon: ImageOutlineIcon,
        isMajor: false,
    },
    {
        key: 'VideoEmbed',
        title: 'Video Attachments',
        description: 'Inline video players for video file attachments.',
        defaultValue: false,
        section: 'media',
        icon: PlayOutlineIcon,
        isMajor: false,
    },
    {
        key: 'VideoLinkEmbed',
        title: 'Video Link Embeds',
        description: 'Embed video players for links with [▶️Video](url) format.',
        defaultValue: false,
        section: 'media',
        icon: LinkVariantIcon,
        isMajor: false,
    },
    {
        key: 'EmbedYoutube',
        title: 'YouTube Embeds',
        description: 'Discord-style YouTube embeds with card layout and red accent bar.',
        defaultValue: false,
        section: 'media',
        icon: VideoOutlineIcon,
        isMajor: false,
    },

    // User Experience
    {
        key: 'CustomChannelIcons',
        title: 'Custom Channel Icons',
        description: 'Set custom icons for channels from 7000+ Material Design icons.',
        defaultValue: false,
        section: 'ux',
        icon: PaletteOutlineIcon,
        isMajor: true,
    },
    {
        key: 'GuildedSounds',
        title: 'Chat Sounds',
        description: 'Guilded-style sound effects for messages and reactions with volume control.',
        defaultValue: false,
        section: 'ux',
        icon: BellRingOutlineIcon,
        isMajor: true,
    },
    {
        key: 'SettingsResorted',
        title: 'Reorganized Settings',
        description: 'User settings reorganized into intuitive categories with icons.',
        defaultValue: false,
        section: 'ux',
        icon: TuneIcon,
        isMajor: false,
    },
    {
        key: 'HideUpdateStatusButton',
        title: 'Hide Status Button',
        description: 'Hide "Update your status" button on posts when no custom status is set.',
        defaultValue: false,
        section: 'ux',
        icon: EyeOffOutlineIcon,
        isMajor: false,
    },

    // Status & Activity
    {
        key: 'AccurateStatuses',
        title: 'Accurate Status Tracking',
        description: 'Heartbeat-based LastActivityAt tracking. Sets Away after inactivity timeout.',
        defaultValue: false,
        section: 'status',
        icon: ClockOutlineIcon,
        isMajor: true,
    },
    {
        key: 'NoOffline',
        title: 'Prevent Offline Status',
        description: 'Keep active users from showing as offline. Hides Offline option from status menu.',
        defaultValue: false,
        section: 'status',
        icon: ClockOutlineIcon,
        isMajor: false,
    },

    // System Console
    {
        key: 'ErrorLogDashboard',
        title: 'Error Log Dashboard',
        description: 'Real-time API and JavaScript error monitoring for admins.',
        defaultValue: false,
        section: 'system',
        icon: AlertCircleOutlineIcon,
        isMajor: false,
    },
    {
        key: 'SystemConsoleDarkMode',
        title: 'Dark Mode',
        description: 'Apply dark mode to System Console using CSS filters.',
        defaultValue: true,
        section: 'system',
        icon: CogOutlineIcon,
        isMajor: false,
    },
    {
        key: 'SystemConsoleHideEnterprise',
        title: 'Hide Enterprise Features',
        description: 'Hide enterprise-only features that require a license.',
        defaultValue: false,
        section: 'system',
        icon: ShieldOutlineIcon,
        isMajor: false,
    },
    {
        key: 'SystemConsoleIcons',
        title: 'Sidebar Icons',
        description: 'Show icons next to subsections in System Console sidebar.',
        defaultValue: false,
        section: 'system',
        icon: CogOutlineIcon,
        isMajor: false,
    },
    {
        key: 'SuppressEnterpriseUpgradeChecks',
        title: 'Suppress Upgrade Checks',
        description: 'Suppress enterprise upgrade API calls that spam 403 errors.',
        defaultValue: true,
        section: 'system',
        icon: ShieldOutlineIcon,
        isMajor: false,
    },

    // Preferences
    {
        key: 'PreferencesRevamp',
        title: 'Preferences Revamp',
        description: 'Refactor preferences to use shared definitions. Required for Preference Overrides.',
        defaultValue: false,
        section: 'preferences',
        icon: TuneIcon,
        isMajor: false,
    },
    {
        key: 'PreferenceOverridesDashboard',
        title: 'Admin Preference Overrides',
        description: 'Dashboard to enforce user preferences server-wide. Requires Preferences Revamp.',
        defaultValue: false,
        section: 'preferences',
        icon: TuneIcon,
        isMajor: false,
    },
];

// Styled components
const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--center-channel-bg);
`;

const ContentWrapper = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 32px;
    width: 100%;
`;

const StatsBar = styled.div`
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
`;

const StatItem = styled.div<{$highlight?: boolean}>`
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    padding: 16px 24px;
    border-radius: 8px;
    flex: 1;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: all 0.2s ease;

    ${(props) => props.$highlight && css`
        border-color: var(--button-bg);
        box-shadow: 0 2px 8px rgba(var(--button-bg-rgb), 0.2);
    `}
`;

const StatLabel = styled.div`
    font-size: 12px;
    text-transform: uppercase;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: 600;
    letter-spacing: 0.5px;
`;

const StatValue = styled.div`
    font-size: 24px;
    font-weight: 700;
    color: var(--center-channel-color);
`;

const SearchRow = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
`;

const ToggleAllButton = styled.button`
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.1);
        border-color: var(--button-bg);
        color: var(--button-color);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const SearchInput = styled.input`
    width: 100%;
    max-width: 400px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
        box-shadow: 0 0 0 3px rgba(var(--button-bg-rgb), 0.15);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const Section = styled.div`
    margin-bottom: 24px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;
    overflow: hidden;
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    padding: 16px 20px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    cursor: pointer;
    transition: background 0.2s ease;
    gap: 16px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const SectionIconWrapper = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--button-bg);
    color: var(--button-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const SectionInfo = styled.div`
    flex: 1;
    min-width: 0;
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

const SectionBadge = styled.span<{$variant: 'enabled' | 'total'}>`
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    background: ${(props) => (props.$variant === 'enabled'
        ? `rgba(var(--button-bg-rgb), 0.15)`
        : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    color: ${(props) => (props.$variant === 'enabled'
        ? 'var(--button-bg)'
        : 'rgba(var(--center-channel-color-rgb), 0.64)')};
`;

const CollapseIconWrapper = styled.div<{$collapsed: boolean}>`
    color: rgba(var(--center-channel-color-rgb), 0.48);
    transition: transform 0.2s ease;
    transform: ${(props) => props.$collapsed ? 'rotate(-90deg)' : 'rotate(0)'};
    display: flex;
    align-items: center;
`;

const SectionContent = styled.div<{$collapsed: boolean}>`
    display: ${(props) => props.$collapsed ? 'none' : 'flex'};
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    background: var(--center-channel-bg);
`;

const FeatureCard = styled.div<{$enabled: boolean; $major: boolean}>`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 8px;
    border: 1px solid ${(props) => props.$enabled
        ? `rgba(var(--button-bg-rgb), 0.3)`
        : 'rgba(var(--center-channel-color-rgb), 0.08)'};
    background: ${(props) => props.$enabled
        ? `rgba(var(--button-bg-rgb), 0.06)`
        : 'var(--center-channel-bg)'};
    transition: all 0.15s ease;
    cursor: pointer;
    box-shadow: ${(props) => props.$major && props.$enabled
        ? `inset 4px 0 0 var(--button-bg)`
        : 'none'};

    &:hover {
        background: ${(props) => props.$enabled
            ? `rgba(var(--button-bg-rgb), 0.1)`
            : 'rgba(var(--center-channel-color-rgb), 0.04)'};
        box-shadow: ${(props) => props.$major && props.$enabled
            ? `inset 4px 0 0 var(--button-bg), 0 2px 8px rgba(0, 0, 0, 0.06)`
            : '0 2px 8px rgba(0, 0, 0, 0.06)'};
    }
`;

const FeatureIconWrapper = styled.div<{$enabled: boolean}>`
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: ${(props) => props.$enabled
        ? `rgba(var(--button-bg-rgb), 0.15)`
        : 'rgba(var(--center-channel-color-rgb), 0.08)'};
    color: ${(props) => props.$enabled
        ? 'var(--button-bg)'
        : 'rgba(var(--center-channel-color-rgb), 0.48)'};
    display: flex;
    align-items: center;
    justify-content: center;
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

const FeatureTitle = styled.div`
    font-size: 14px;
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
    background: var(--button-bg);
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
    color: rgba(var(--center-channel-color-rgb), 0.4);
    margin-top: 8px;
`;

const UnsavedDot = styled.span`
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #FFA500;
    margin-left: 8px;
`;

const ToggleWrapper = styled.div`
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
    cursor: pointer;
`;

const ToggleInput = styled.input`
    opacity: 0;
    width: 0;
    height: 0;
`;

const ToggleSlider = styled.span<{$checked: boolean; $disabled?: boolean}>`
    position: absolute;
    cursor: ${(props) => props.$disabled ? 'not-allowed' : 'pointer'};
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${(props) => props.$checked ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.24)'};
    transition: 0.2s;
    border-radius: 24px;
    opacity: ${(props) => props.$disabled ? 0.5 : 1};

    &:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: ${(props) => props.$checked ? '23px' : '3px'};
        bottom: 3px;
        background-color: white;
        transition: 0.2s;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
`;

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

// Helper function
function toBool(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true';
    }
    return false;
}

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
    disabled?: boolean;
};

const MattermostExtendedFeatures: React.FC<Props> = ({config, patchConfig, disabled = false}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(new Set());
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Build feature lookup
    const featuresByKey = useMemo(() => {
        const map: Record<string, FeatureDefinition> = {};
        for (const feature of FEATURES) {
            map[feature.key] = feature;
        }
        return map;
    }, []);

    // Initialize flags from config
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
            f.key.toLowerCase().includes(term),
        );
    }, [searchTerm]);

    // Group by section
    const featuresBySection = useMemo(() => {
        const grouped: Record<SectionId, FeatureDefinition[]> = {
            security: [],
            messaging: [],
            media: [],
            layout: [],
            ux: [],
            status: [],
            system: [],
            preferences: [],
        };
        for (const feature of filteredFeatures) {
            grouped[feature.section].push(feature);
        }
        // Sort: major first, then alphabetically
        for (const section of Object.keys(grouped) as SectionId[]) {
            grouped[section].sort((a, b) => {
                if (a.isMajor && !b.isMajor) {
                    return -1;
                }
                if (!a.isMajor && b.isMajor) {
                    return 1;
                }
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
        return {total, enabled, majorEnabled, majorTotal, unsaved: Object.keys(changedFlags).length};
    }, [localFlags, changedFlags]);

    const handleToggle = useCallback((key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setLocalFlags((prev) => ({...prev, [key]: !prev[key]}));
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

    const allEnabled = stats.enabled === stats.total;

    const handleToggleAll = useCallback(() => {
        const newValue = !allEnabled;
        setLocalFlags((prev) => {
            const next = {...prev};
            for (const feature of FEATURES) {
                next[feature.key] = newValue;
            }
            return next;
        });
        setServerError(null);
    }, [allEnabled]);

    const handleSave = useCallback(async () => {
        if (!saveNeeded) {
            return;
        }
        setSaving(true);
        setServerError(null);

        try {
            // CRITICAL: Preserve ALL existing feature flags, then apply our changes
            // The patch API does shallow merging, so we must spread existing flags
            const allFlags: Record<string, boolean> = {};

            // First, copy ALL existing feature flags from config
            if (config.FeatureFlags) {
                for (const [key, value] of Object.entries(config.FeatureFlags)) {
                    if (key !== 'TestFeature') {
                        allFlags[key] = toBool(value);
                    }
                }
            }

            // Then apply our local changes
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
        const Icon = feature.icon;

        const toggle = (
            <ToggleWrapper onClick={(e) => handleToggle(feature.key, e)}>
                <ToggleInput
                    type='checkbox'
                    checked={isEnabled}
                    onChange={() => {}}
                    disabled={disabled}
                />
                <ToggleSlider
                    $checked={isEnabled}
                    $disabled={disabled}
                />
            </ToggleWrapper>
        );

        return (
            <FeatureCard
                key={feature.key}
                $enabled={isEnabled}
                $major={feature.isMajor}
                onClick={(e) => handleToggle(feature.key, e)}
            >
                <FeatureIconWrapper $enabled={isEnabled}>
                    <Icon size={18}/>
                </FeatureIconWrapper>
                <FeatureInfo>
                    <FeatureHeader>
                        <FeatureTitle>
                            {feature.title}
                            {isModified && <UnsavedDot title='Unsaved change'/>}
                        </FeatureTitle>
                        {feature.isMajor && <MajorBadge>{'Major'}</MajorBadge>}
                    </FeatureHeader>
                    <FeatureDescription>{feature.description}</FeatureDescription>
                </FeatureInfo>
                {toggle}
            </FeatureCard>
        );
    };

    const renderSection = (section: SectionDefinition) => {
        const features = featuresBySection[section.id];
        if (features.length === 0) {
            return null;
        }

        const isCollapsed = collapsedSections.has(section.id);
        const enabledCount = features.filter((f) => localFlags[f.key]).length;
        const Icon = section.icon;

        return (
            <Section key={section.id}>
                <SectionHeader onClick={() => toggleSection(section.id)}>
                    <SectionIconWrapper>
                        <Icon size={22}/>
                    </SectionIconWrapper>
                    <SectionInfo>
                        <SectionTitle>{section.title}</SectionTitle>
                        <SectionDescription>{section.description}</SectionDescription>
                    </SectionInfo>
                    <SectionStats>
                        <SectionBadge $variant='enabled'>{enabledCount}{' enabled'}</SectionBadge>
                        <SectionBadge $variant='total'>{features.length}{' total'}</SectionBadge>
                    </SectionStats>
                    <CollapseIconWrapper $collapsed={isCollapsed}>
                        <ChevronDownIcon size={20}/>
                    </CollapseIconWrapper>
                </SectionHeader>
                <SectionContent $collapsed={isCollapsed}>
                    {features.map(renderFeatureCard)}
                </SectionContent>
            </Section>
        );
    };

    const hasResults = filteredFeatures.length > 0;

    return (
        <Container className='wrapper--admin'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>

            <ContentWrapper>
                <StatsBar>
                    <StatItem $highlight={stats.majorEnabled > 0}>
                        <StatLabel>{'Major Features'}</StatLabel>
                        <StatValue>{stats.majorEnabled}{' / '}{stats.majorTotal}</StatValue>
                    </StatItem>
                    <StatItem>
                        <StatLabel>{'Total Enabled'}</StatLabel>
                        <StatValue>{stats.enabled}{' / '}{stats.total}</StatValue>
                    </StatItem>
                    <StatItem $highlight={stats.unsaved > 0}>
                        <StatLabel>{'Unsaved Changes'}</StatLabel>
                        <StatValue>{stats.unsaved}</StatValue>
                    </StatItem>
                </StatsBar>

                <SearchRow>
                    <SearchInput
                        type='text'
                        placeholder='Search features...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <ToggleAllButton
                        onClick={handleToggleAll}
                        disabled={disabled}
                    >
                        {allEnabled ? 'Disable All' : 'Enable All'}
                    </ToggleAllButton>
                </SearchRow>

                {hasResults ? (
                    SECTIONS.map(renderSection)
                ) : (
                    <NoResults>
                        {'No features match your search'}
                    </NoResults>
                )}
            </ContentWrapper>

            <SaveContainer>
                <SaveButton
                    saving={saving}
                    disabled={disabled || !saveNeeded}
                    onClick={handleSave}
                    savingMessage={
                        <FormattedMessage
                            id='admin.saving'
                            defaultMessage='Saving Config...'
                        />
                    }
                />
                {serverError && <FormError error={serverError}/>}
            </SaveContainer>
        </Container>
    );
};

export default MattermostExtendedFeatures;
