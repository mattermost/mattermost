// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import styled from 'styled-components';

import type {AdminConfig, FeatureFlags as FeatureFlagsType} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import FormError from 'components/form_error';

export const messages = defineMessages({
    title: {id: 'admin.feature_flags.title', defaultMessage: 'Feature Flags'},
    mattermostExtendedTitle: {id: 'admin.mattermost_extended.features.title', defaultMessage: 'Features'},
});

// Metadata for each feature flag - descriptions and default values
const FLAG_METADATA: Record<string, {description: string; defaultValue: boolean}> = {
    TestBoolFeature: {
        description: 'Test flag for development purposes',
        defaultValue: false,
    },
    EnableRemoteClusterService: {
        description: 'Enable the remote cluster service for shared channels',
        defaultValue: false,
    },
    EnableSharedChannelsDMs: {
        description: 'Enable DMs and GMs for shared channels',
        defaultValue: false,
    },
    EnableSharedChannelsPlugins: {
        description: 'Enable plugins in shared channels',
        defaultValue: true,
    },
    EnableSharedChannelsMemberSync: {
        description: 'Enable synchronization of channel members in shared channels',
        defaultValue: false,
    },
    EnableSyncAllUsersForRemoteCluster: {
        description: 'Enable syncing all users for remote clusters in shared channels',
        defaultValue: false,
    },
    AppsEnabled: {
        description: 'Toggle the Apps framework functionalities both in server and client side',
        defaultValue: false,
    },
    CustomChannelIcons: {
        description: 'Allow custom icons for channels in the sidebar',
        defaultValue: false,
    },
    PermalinkPreviews: {
        description: 'Enable permalink previews in messages',
        defaultValue: false,
    },
    NormalizeLdapDNs: {
        description: 'Normalize LDAP distinguished names',
        defaultValue: false,
    },
    WysiwygEditor: {
        description: 'Enable WYSIWYG text editor',
        defaultValue: false,
    },
    OnboardingTourTips: {
        description: 'Show onboarding tour tips for new users',
        defaultValue: true,
    },
    DeprecateCloudFree: {
        description: 'Deprecate cloud free tier',
        defaultValue: false,
    },
    EnableExportDirectDownload: {
        description: 'Enable direct download of exports',
        defaultValue: false,
    },
    MoveThreadsEnabled: {
        description: 'Allow moving threads between channels',
        defaultValue: false,
    },
    StreamlinedMarketplace: {
        description: 'Use streamlined marketplace UI',
        defaultValue: true,
    },
    CloudIPFiltering: {
        description: 'Enable IP filtering for cloud instances',
        defaultValue: false,
    },
    ConsumePostHook: {
        description: 'Enable consume post hook functionality',
        defaultValue: false,
    },
    CloudAnnualRenewals: {
        description: 'Enable cloud annual renewals',
        defaultValue: false,
    },
    CloudDedicatedExportUI: {
        description: 'Show dedicated export UI for cloud',
        defaultValue: false,
    },
    ChannelBookmarks: {
        description: 'Enable channel bookmarks feature',
        defaultValue: true,
    },
    WebSocketEventScope: {
        description: 'Enable WebSocket event scoping',
        defaultValue: true,
    },
    NotificationMonitoring: {
        description: 'Enable notification monitoring and analytics',
        defaultValue: true,
    },
    ExperimentalAuditSettingsSystemConsoleUI: {
        description: 'Show experimental audit settings in System Console',
        defaultValue: true,
    },
    CustomProfileAttributes: {
        description: 'Enable custom profile attributes for users',
        defaultValue: true,
    },
    AttributeBasedAccessControl: {
        description: 'Enable attribute-based access control',
        defaultValue: true,
    },
    ContentFlagging: {
        description: 'Enable content flagging and moderation',
        defaultValue: true,
    },
    InteractiveDialogAppsForm: {
        description: 'Use AppsForm for Interactive Dialogs instead of legacy implementation',
        defaultValue: true,
    },
    EnableMattermostEntry: {
        description: 'Enable Mattermost entry point',
        defaultValue: true,
    },
    MobileSSOCodeExchange: {
        description: 'Enable mobile SSO SAML code-exchange flow (no tokens in deep links)',
        defaultValue: true,
    },
    AutoTranslation: {
        description: 'Enable auto-translation feature for messages in channels',
        defaultValue: false,
    },
    BurnOnRead: {
        description: 'Enable burn-on-read messages that automatically delete after viewing',
        defaultValue: true,
    },
    EnableAIPluginBridge: {
        description: 'Enable AI plugin bridge functionality',
        defaultValue: false,
    },
    Encryption: {
        description: 'Enable end-to-end encryption for messages using RSA-OAEP + AES-GCM hybrid encryption',
        defaultValue: false,
    },
    ThreadsInSidebar: {
        description: 'Display followed threads under their parent channels in the sidebar instead of only in Threads view',
        defaultValue: false,
    },
    CustomThreadNames: {
        description: 'Allow users to set custom names for threads from the thread header',
        defaultValue: false,
    },
    GuildedSounds: {
        description: 'Enable Guilded-style sounds for message/reaction interactions',
        defaultValue: false,
    },
    DiscordReplies: {
        description: 'Enable Discord-style inline replies with quote previews instead of thread-based replies',
        defaultValue: false,
    },
    ErrorLogDashboard: {
        description: 'Enable error log dashboard for system admins to monitor API and JavaScript errors in real-time',
        defaultValue: false,
    },
    SystemConsoleDarkMode: {
        description: 'Apply dark mode to the System Console using CSS filters',
        defaultValue: true,
    },
    SystemConsoleHideEnterprise: {
        description: 'Hide enterprise-only features from System Console that require a license to use',
        defaultValue: false,
    },
    SystemConsoleIcons: {
        description: 'Show icons next to each subsection in the System Console sidebar for better visual navigation',
        defaultValue: false,
    },
    SuppressEnterpriseUpgradeChecks: {
        description: 'Suppress enterprise upgrade API calls that spam 403 errors on Team Edition builds',
        defaultValue: true,
    },
};

// Styled components
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

const ControlsRow = styled.div`
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    align-items: center;
`;

const SearchInput = styled.input`
    flex: 1;
    min-width: 200px;
    max-width: 400px;
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    font-size: 14px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);

    &:focus {
        outline: none;
        border-color: var(--button-bg);
        box-shadow: 0 0 0 2px rgba(var(--button-bg-rgb), 0.16);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const FilterSelect = styled.select`
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    font-size: 14px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    cursor: pointer;
    min-width: 150px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }
`;

const StatsBar = styled.div`
    display: flex;
    gap: 24px;
    padding: 12px 16px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    margin-bottom: 24px;
    font-size: 14px;
`;

const StatItem = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.72);

    strong {
        color: var(--center-channel-color);
        margin-right: 4px;
    }
`;

const FlagsGrid = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const FlagCard = styled.div<{isEnabled: boolean; isOverride: boolean; useStatusStyling?: boolean}>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: ${({isOverride, isEnabled, useStatusStyling}) =>
        useStatusStyling ? (isEnabled ? 'rgba(61, 204, 145, 0.04)' : 'var(--center-channel-bg)') :
            isOverride ? 'rgba(138, 43, 226, 0.04)' : 'var(--center-channel-bg)'};
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    transition: all 0.15s ease;
    border-left: 4px solid ${({isOverride, isEnabled, useStatusStyling}) =>
        useStatusStyling ? (isEnabled ? 'var(--online-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.16)') :
            isOverride ? '#8A2BE2' :
                isEnabled ? 'var(--online-indicator)' :
                    'rgba(var(--center-channel-color-rgb), 0.16)'};

    &:hover {
        background: ${({isOverride, isEnabled, useStatusStyling}) =>
            useStatusStyling ? (isEnabled ? 'rgba(61, 204, 145, 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.04)') :
                isOverride ? 'rgba(138, 43, 226, 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.04)'};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
`;

const FlagInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const FlagName = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--center-channel-color);
    margin-bottom: 4px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
`;

const FlagDescription = styled.div`
    font-size: 13px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    line-height: 1.4;
`;

const OverrideBadge = styled.span`
    display: inline-block;
    padding: 2px 8px;
    margin-left: 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 10px;
    background: rgba(138, 43, 226, 0.12);
    color: #8A2BE2;
`;

const EnabledBadge = styled.span`
    display: inline-block;
    padding: 2px 8px;
    margin-left: 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 10px;
    background: rgba(61, 204, 145, 0.12);
    color: var(--online-indicator);
`;

const DisabledBadge = styled.span`
    display: inline-block;
    padding: 2px 8px;
    margin-left: 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 10px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const UnsavedBadge = styled.span`
    display: inline-block;
    padding: 2px 8px;
    margin-left: 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 10px;
    background: rgba(255, 165, 0, 0.12);
    color: #FFA500;
`;

const ToggleSwitch = styled.label`
    position: relative;
    display: inline-block;
    width: 48px;
    height: 28px;
    flex-shrink: 0;
    margin-left: 16px;
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

const NoResults = styled.div`
    text-align: center;
    padding: 48px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 14px;
`;

const SaveContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 32px;
    background: var(--center-channel-bg);
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
    disabled?: boolean;
    allowedFlags?: string[];
    title?: React.ReactNode;
    introBanner?: React.ReactNode;
    showStatusBadge?: boolean; // Show "enabled"/"disabled" instead of "override"
};

type FilterType = 'all' | 'enabled' | 'disabled' | 'default' | 'modified';

// Convert a flag value (which can be string or boolean) to a boolean
function toBool(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true';
    }
    return false;
}

const FeatureFlags: React.FC<Props> = ({config, patchConfig, disabled = false, allowedFlags, title, introBanner, showStatusBadge = false}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');

    // Convert config flags to proper booleans (keep ALL flags for saving)
    // Start with all known flags at their defaults, then override with config values
    const initialFlags = useMemo(() => {
        const flags: Record<string, boolean> = {};

        // First, populate ALL known flags with their default values
        // This ensures we always send a complete set when saving
        for (const [key, meta] of Object.entries(FLAG_METADATA)) {
            flags[key] = meta.defaultValue;
        }

        // Then override with actual values from server config
        if (config.FeatureFlags) {
            for (const [key, value] of Object.entries(config.FeatureFlags)) {
                if (key !== 'TestFeature') { // Skip string-only flags
                    flags[key] = toBool(value);
                }
            }
        }

        return flags;
    }, [config.FeatureFlags]);

    const [localFlags, setLocalFlags] = useState<Record<string, boolean>>(initialFlags);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Sync localFlags when config changes (e.g., after save)
    useEffect(() => {
        setLocalFlags(initialFlags);
    }, [initialFlags]);

    // Track which flags have been changed
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

    // Get flag entries from the local state (filtered for display if allowedFlags provided)
    const flagEntries = useMemo(() => {
        return Object.entries(localFlags)
            .filter(([key]) => !allowedFlags || allowedFlags.includes(key))
            .map(([key, value]) => ({
                key,
                value,
                description: FLAG_METADATA[key]?.description || 'No description available',
                defaultValue: FLAG_METADATA[key]?.defaultValue ?? false,
                isModified: initialFlags[key] !== value,
            }));
    }, [localFlags, initialFlags, allowedFlags]);

    // Filter and search
    const filteredFlags = useMemo(() => {
        return flagEntries.filter((flag) => {
            // Search filter
            const matchesSearch = searchTerm === '' ||
                flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                flag.description.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) {
                return false;
            }

            // Status filter
            switch (filter) {
            case 'enabled':
                return flag.value === true;
            case 'disabled':
                return flag.value === false;
            case 'default':
                return flag.value === flag.defaultValue;
            case 'modified':
                return flag.value !== flag.defaultValue;
            default:
                return true;
            }
        }).sort((a, b) => a.key.localeCompare(b.key));
    }, [flagEntries, searchTerm, filter]);

    // Stats
    const stats = useMemo(() => {
        const enabled = flagEntries.filter((f) => f.value).length;
        const nonDefault = flagEntries.filter((f) => f.value !== f.defaultValue).length;
        const pending = flagEntries.filter((f) => f.isModified).length;
        return {
            total: flagEntries.length,
            enabled,
            disabled: flagEntries.length - enabled,
            nonDefault,
            pending,
        };
    }, [flagEntries]);

    const handleToggle = useCallback((key: string, newValue: boolean) => {
        setLocalFlags((prev) => ({
            ...prev,
            [key]: newValue,
        }));
        setServerError(null);
    }, []);

    const handleSave = useCallback(async () => {
        if (Object.keys(changedFlags).length === 0) {
            return;
        }

        setSaving(true);
        setServerError(null);

        try {
            // Send ALL feature flags to prevent server from clearing unmentioned ones
            const result = await patchConfig({
                FeatureFlags: localFlags,
            });

            if (result.error) {
                setServerError(result.error.message || 'Failed to save configuration');
            } else {
                // Update initialFlags reference by reloading from result
                // The page will refresh with new config from parent
            }
        } catch (err: unknown) {
            setServerError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    }, [changedFlags, localFlags, patchConfig]);

    return (
        <Container className='wrapper--admin'>
            <AdminHeader>
                {title || <FormattedMessage {...messages.title}/>}
            </AdminHeader>

            <ContentWrapper>
                <div className='banner info'>
                    <div className='banner__content'>
                        {introBanner || (
                            <FormattedMessage
                                id='admin.feature_flags.introBanner'
                                defaultMessage='Feature flags control experimental and beta features. Changes take effect after saving. Some flags may require a server restart.'
                            />
                        )}
                    </div>
                </div>

                <ControlsRow>
                    <SearchInput
                        type='text'
                        placeholder='Search flags...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <FilterSelect
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                    >
                        <option value='all'>All Flags</option>
                        <option value='enabled'>Enabled</option>
                        <option value='disabled'>Disabled</option>
                        <option value='modified'>Modified from Default</option>
                        <option value='default'>Using Default</option>
                    </FilterSelect>
                </ControlsRow>

                <StatsBar>
                    <StatItem>
                        <strong>{stats.total}</strong>
                        {'Total'}
                    </StatItem>
                    <StatItem>
                        <strong>{stats.enabled}</strong>
                        {'Enabled'}
                    </StatItem>
                    <StatItem>
                        <strong>{stats.disabled}</strong>
                        {'Disabled'}
                    </StatItem>
                    {!showStatusBadge && stats.nonDefault > 0 && (
                        <StatItem style={{color: '#8A2BE2'}}>
                            <strong>{stats.nonDefault}</strong>
                            {'Overrides'}
                        </StatItem>
                    )}
                    {stats.pending > 0 && (
                        <StatItem style={{color: '#FFA500'}}>
                            <strong>{stats.pending}</strong>
                            {'Unsaved'}
                        </StatItem>
                    )}
                </StatsBar>

                <FlagsGrid>
                    {filteredFlags.length === 0 ? (
                        <NoResults>
                            <FormattedMessage
                                id='admin.feature_flags.noResults'
                                defaultMessage='No feature flags match your search criteria'
                            />
                        </NoResults>
                    ) : (
                        filteredFlags.map((flag) => (
                            <FlagCard
                                key={flag.key}
                                isEnabled={flag.value}
                                isOverride={flag.value !== flag.defaultValue}
                                useStatusStyling={showStatusBadge}
                            >
                                <FlagInfo>
                                    <FlagName>
                                        {flag.key}
                                        {flag.isModified && (
                                            <UnsavedBadge>{'unsaved'}</UnsavedBadge>
                                        )}
                                        {!flag.isModified && showStatusBadge && flag.value && (
                                            <EnabledBadge>{'enabled'}</EnabledBadge>
                                        )}
                                        {!flag.isModified && showStatusBadge && !flag.value && (
                                            <DisabledBadge>{'disabled'}</DisabledBadge>
                                        )}
                                        {!flag.isModified && !showStatusBadge && flag.value !== flag.defaultValue && (
                                            <OverrideBadge>{'override'}</OverrideBadge>
                                        )}
                                    </FlagName>
                                    <FlagDescription>
                                        {flag.description}
                                        {' '}
                                        <span style={{opacity: 0.7}}>
                                            {'(Default: '}
                                            {flag.defaultValue ? 'enabled' : 'disabled'}
                                            {')'}
                                        </span>
                                    </FlagDescription>
                                </FlagInfo>
                                <ToggleSwitch>
                                    <HiddenCheckbox
                                        type='checkbox'
                                        checked={flag.value}
                                        onChange={(e) => handleToggle(flag.key, e.target.checked)}
                                        disabled={disabled}
                                    />
                                    <ToggleSlider
                                        checked={flag.value}
                                        disabled={disabled}
                                    />
                                </ToggleSwitch>
                            </FlagCard>
                        ))
                    )}
                </FlagsGrid>
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
                {serverError && (
                    <FormError error={serverError}/>
                )}
            </SaveContainer>
        </Container>
    );
};

export default FeatureFlags;
