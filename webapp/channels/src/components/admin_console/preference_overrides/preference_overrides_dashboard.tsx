// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {Client4} from 'mattermost-redux/client';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import './preference_overrides_dashboard.scss';

type PreferenceKey = {
    category: string;
    name: string;
};

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
};

// Metadata for known preferences - provides friendly labels and value options
const PREFERENCE_METADATA: Record<string, {
    label: string;
    preferences: Record<string, {
        label: string;
        description?: string;
        options?: Array<{value: string; label: string}>;
    }>;
}> = {
    display_settings: {
        label: 'Display Settings',
        preferences: {
            use_military_time: {
                label: 'Clock Display',
                description: 'Format for displaying time',
                options: [
                    {value: 'true', label: '24-hour clock'},
                    {value: 'false', label: '12-hour clock'},
                ],
            },
            channel_display_mode: {
                label: 'Channel Display',
                description: 'How channels are displayed',
                options: [
                    {value: 'full', label: 'Full width'},
                    {value: 'centered', label: 'Fixed width, centered'},
                ],
            },
            message_display: {
                label: 'Message Display',
                description: 'How messages are displayed',
                options: [
                    {value: 'clean', label: 'Standard'},
                    {value: 'compact', label: 'Compact'},
                ],
            },
            collapse_previews: {
                label: 'Link Previews',
                description: 'Whether to show link previews by default',
                options: [
                    {value: 'false', label: 'Show link previews'},
                    {value: 'true', label: 'Collapse link previews'},
                ],
            },
            colorize_usernames: {
                label: 'Colorize Usernames',
                description: 'Assign unique colors to usernames',
                options: [
                    {value: 'true', label: 'Enabled'},
                    {value: 'false', label: 'Disabled'},
                ],
            },
            name_format: {
                label: 'Teammate Name Display',
                description: 'How to display teammate names',
                options: [
                    {value: 'username', label: 'Show username'},
                    {value: 'nickname_full_name', label: 'Show nickname if available, otherwise full name'},
                    {value: 'full_name', label: 'Show full name'},
                ],
            },
            collapse_consecutive_messages: {
                label: 'Collapse Consecutive Messages',
                description: 'Collapse messages from the same user',
                options: [
                    {value: 'true', label: 'Enabled'},
                    {value: 'false', label: 'Disabled'},
                ],
            },
        },
    },
    notifications: {
        label: 'Notifications',
        preferences: {
            email_interval: {
                label: 'Email Notification Frequency',
                description: 'How often to send email notifications',
                options: [
                    {value: '30', label: 'Immediately'},
                    {value: '900', label: 'Every 15 minutes'},
                    {value: '3600', label: 'Every hour'},
                    {value: '0', label: 'Never'},
                ],
            },
        },
    },
    advanced_settings: {
        label: 'Advanced Settings',
        preferences: {
            formatting: {
                label: 'Enable Message Formatting',
                description: 'Whether to format messages with markdown',
                options: [
                    {value: 'true', label: 'Enabled'},
                    {value: 'false', label: 'Disabled'},
                ],
            },
            send_on_ctrl_enter: {
                label: 'Send Messages on CTRL+Enter',
                description: 'Require CTRL+Enter to send messages',
                options: [
                    {value: 'true', label: 'On'},
                    {value: 'false', label: 'Off'},
                ],
            },
            join_leave: {
                label: 'Join/Leave Messages',
                description: 'Show join/leave messages in channels',
                options: [
                    {value: 'true', label: 'Show'},
                    {value: 'false', label: 'Hide'},
                ],
            },
            sync_drafts: {
                label: 'Sync Drafts',
                description: 'Sync message drafts across devices',
                options: [
                    {value: 'true', label: 'Enabled'},
                    {value: 'false', label: 'Disabled'},
                ],
            },
        },
    },
    sidebar_settings: {
        label: 'Sidebar Settings',
        preferences: {
            show_unread_section: {
                label: 'Unread Section',
                description: 'Group unread channels in a separate section',
                options: [
                    {value: 'true', label: 'Enabled'},
                    {value: 'false', label: 'Disabled'},
                ],
            },
            limit_visible_dms_gms: {
                label: 'Visible DMs/GMs',
                description: 'Number of direct/group messages to show',
            },
        },
    },
};

// SVG Icons
const IconSave = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/>
        <polyline points='17 21 17 13 7 13 7 21'/>
        <polyline points='7 3 7 8 15 8'/>
    </svg>
);

const IconCheck = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polyline points='20 6 9 17 4 12'/>
    </svg>
);

const IconX = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <line
            x1='18'
            y1='6'
            x2='6'
            y2='18'
        />
        <line
            x1='6'
            y1='6'
            x2='18'
            y2='18'
        />
    </svg>
);

const IconLock = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect
            x='3'
            y='11'
            width='18'
            height='11'
            rx='2'
            ry='2'
        />
        <path d='M7 11V7a5 5 0 0 1 10 0v4'/>
    </svg>
);

const IconUnlock = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect
            x='3'
            y='11'
            width='18'
            height='11'
            rx='2'
            ry='2'
        />
        <path d='M7 11V7a5 5 0 0 1 9.9-1'/>
    </svg>
);

const IconRefresh = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polyline points='23 4 23 10 17 10'/>
        <polyline points='1 20 1 14 7 14'/>
        <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'/>
    </svg>
);

const PreferenceOverridesDashboard: React.FC<Props> = ({config, patchConfig}) => {
    const intl = useIntl();
    const [availablePreferences, setAvailablePreferences] = useState<PreferenceKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Local state for overrides being edited
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Load current overrides from config
    useEffect(() => {
        const currentOverrides = config.MattermostExtendedSettings?.Preferences?.Overrides || {};
        setOverrides({...currentOverrides});
    }, [config.MattermostExtendedSettings?.Preferences?.Overrides]);

    // Load available preferences from database
    const loadPreferences = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const keys = await Client4.getDistinctPreferences();
            setAvailablePreferences(keys);
        } catch (e) {
            console.error('Failed to load preferences:', e);
            setError(intl.formatMessage({
                id: 'admin.preference_overrides.error.load',
                defaultMessage: 'Failed to load preferences. Make sure you have system admin permissions.',
            }));
        } finally {
            setLoading(false);
        }
    }, [intl]);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // Group preferences by category
    const groupedPreferences = React.useMemo(() => {
        const groups: Record<string, PreferenceKey[]> = {};
        availablePreferences.forEach((pref) => {
            if (!groups[pref.category]) {
                groups[pref.category] = [];
            }
            groups[pref.category].push(pref);
        });
        return groups;
    }, [availablePreferences]);

    // Check if a preference is currently overridden
    const isOverridden = (category: string, name: string): boolean => {
        const key = `${category}:${name}`;
        return key in overrides;
    };

    // Toggle override for a preference
    const toggleOverride = (category: string, name: string) => {
        const key = `${category}:${name}`;
        setOverrides((prev) => {
            const newOverrides = {...prev};
            if (key in newOverrides) {
                delete newOverrides[key];
            } else {
                // Get default value from metadata or use empty string
                const metadata = PREFERENCE_METADATA[category]?.preferences[name];
                const defaultValue = metadata?.options?.[0]?.value || '';
                newOverrides[key] = defaultValue;
            }
            return newOverrides;
        });
        setHasChanges(true);
        setSaveSuccess(false);
    };

    // Update override value
    const updateOverrideValue = (category: string, name: string, value: string) => {
        const key = `${category}:${name}`;
        setOverrides((prev) => ({
            ...prev,
            [key]: value,
        }));
        setHasChanges(true);
        setSaveSuccess(false);
    };

    // Save changes
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            // IMPORTANT: Spread existing settings to avoid overwriting other values
            await patchConfig({
                MattermostExtendedSettings: {
                    ...config.MattermostExtendedSettings,
                    Preferences: {
                        ...config.MattermostExtendedSettings?.Preferences,
                        Overrides: overrides,
                    },
                },
            });
            setHasChanges(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error('Failed to save preferences:', e);
            setError(intl.formatMessage({
                id: 'admin.preference_overrides.error.save',
                defaultMessage: 'Failed to save preference overrides.',
            }));
        } finally {
            setSaving(false);
        }
    };

    // Get preference label
    const getPreferenceLabel = (category: string, name: string): string => {
        return PREFERENCE_METADATA[category]?.preferences[name]?.label || name;
    };

    // Get preference description
    const getPreferenceDescription = (category: string, name: string): string | undefined => {
        return PREFERENCE_METADATA[category]?.preferences[name]?.description;
    };

    // Get category label
    const getCategoryLabel = (category: string): string => {
        return PREFERENCE_METADATA[category]?.label || category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    // Get preference options
    const getPreferenceOptions = (category: string, name: string): Array<{value: string; label: string}> | undefined => {
        return PREFERENCE_METADATA[category]?.preferences[name]?.options;
    };

    // Count active overrides
    const activeOverrideCount = Object.keys(overrides).length;

    return (
        <div className='wrapper--fixed PreferenceOverridesDashboard'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.sidebar.user_preferences'
                    defaultMessage='User Preferences'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='PreferenceOverridesDashboard__header'>
                    <div className='PreferenceOverridesDashboard__header-left'>
                        <h2>
                            <FormattedMessage
                                id='admin.preference_overrides.title'
                                defaultMessage='Preference Overrides'
                            />
                        </h2>
                        <p className='PreferenceOverridesDashboard__subtitle'>
                            <FormattedMessage
                                id='admin.preference_overrides.description'
                                defaultMessage='Override user preferences with admin-enforced values. Overridden settings are hidden from users and cannot be changed.'
                            />
                        </p>
                    </div>
                    <div className='PreferenceOverridesDashboard__header-right'>
                        <button
                            className='btn btn-tertiary'
                            onClick={loadPreferences}
                            disabled={loading}
                        >
                            <IconRefresh/>
                            <FormattedMessage
                                id='admin.preference_overrides.refresh'
                                defaultMessage='Refresh'
                            />
                        </button>
                        <button
                            className={`btn ${hasChanges ? 'btn-primary' : 'btn-tertiary'}`}
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                        >
                            {saving ? (
                                <FormattedMessage
                                    id='admin.preference_overrides.saving'
                                    defaultMessage='Saving...'
                                />
                            ) : saveSuccess ? (
                                <>
                                    <IconCheck/>
                                    <FormattedMessage
                                        id='admin.preference_overrides.saved'
                                        defaultMessage='Saved'
                                    />
                                </>
                            ) : (
                                <>
                                    <IconSave/>
                                    <FormattedMessage
                                        id='admin.preference_overrides.save'
                                        defaultMessage='Save Changes'
                                    />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Stats bar */}
                <div className='PreferenceOverridesDashboard__stats'>
                    <div className='PreferenceOverridesDashboard__stat'>
                        <span className='PreferenceOverridesDashboard__stat-value'>{activeOverrideCount}</span>
                        <span className='PreferenceOverridesDashboard__stat-label'>
                            <FormattedMessage
                                id='admin.preference_overrides.active_overrides'
                                defaultMessage='Active Overrides'
                            />
                        </span>
                    </div>
                    <div className='PreferenceOverridesDashboard__stat'>
                        <span className='PreferenceOverridesDashboard__stat-value'>{availablePreferences.length}</span>
                        <span className='PreferenceOverridesDashboard__stat-label'>
                            <FormattedMessage
                                id='admin.preference_overrides.available_preferences'
                                defaultMessage='Available Preferences'
                            />
                        </span>
                    </div>
                </div>

                {error && (
                    <div className='PreferenceOverridesDashboard__error'>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className='PreferenceOverridesDashboard__loading'>
                        <FormattedMessage
                            id='admin.preference_overrides.loading'
                            defaultMessage='Loading preferences...'
                        />
                    </div>
                ) : (
                    <div className='PreferenceOverridesDashboard__categories'>
                        {Object.entries(groupedPreferences).map(([category, prefs]) => (
                            <div
                                key={category}
                                className='PreferenceOverridesDashboard__category'
                            >
                                <div className='PreferenceOverridesDashboard__category-header'>
                                    <h3>{getCategoryLabel(category)}</h3>
                                    <span className='PreferenceOverridesDashboard__category-count'>
                                        {prefs.filter((p) => isOverridden(p.category, p.name)).length} / {prefs.length}
                                    </span>
                                </div>
                                <div className='PreferenceOverridesDashboard__preferences'>
                                    {prefs.map((pref) => {
                                        const key = `${pref.category}:${pref.name}`;
                                        const overridden = isOverridden(pref.category, pref.name);
                                        const options = getPreferenceOptions(pref.category, pref.name);
                                        const description = getPreferenceDescription(pref.category, pref.name);

                                        return (
                                            <div
                                                key={key}
                                                className={`PreferenceOverridesDashboard__preference ${overridden ? 'overridden' : ''}`}
                                            >
                                                <div className='PreferenceOverridesDashboard__preference-header'>
                                                    <button
                                                        className={`PreferenceOverridesDashboard__toggle ${overridden ? 'active' : ''}`}
                                                        onClick={() => toggleOverride(pref.category, pref.name)}
                                                        title={overridden ? 'Remove override' : 'Enable override'}
                                                    >
                                                        {overridden ? <IconLock/> : <IconUnlock/>}
                                                    </button>
                                                    <div className='PreferenceOverridesDashboard__preference-info'>
                                                        <span className='PreferenceOverridesDashboard__preference-label'>
                                                            {getPreferenceLabel(pref.category, pref.name)}
                                                        </span>
                                                        {description && (
                                                            <span className='PreferenceOverridesDashboard__preference-description'>
                                                                {description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {overridden && (
                                                    <div className='PreferenceOverridesDashboard__preference-value'>
                                                        {options ? (
                                                            <select
                                                                value={overrides[key] || ''}
                                                                onChange={(e) => updateOverrideValue(pref.category, pref.name, e.target.value)}
                                                            >
                                                                {options.map((opt) => (
                                                                    <option
                                                                        key={opt.value}
                                                                        value={opt.value}
                                                                    >
                                                                        {opt.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type='text'
                                                                value={overrides[key] || ''}
                                                                onChange={(e) => updateOverrideValue(pref.category, pref.name, e.target.value)}
                                                                placeholder={intl.formatMessage({
                                                                    id: 'admin.preference_overrides.value_placeholder',
                                                                    defaultMessage: 'Enter enforced value...',
                                                                })}
                                                            />
                                                        )}
                                                        <button
                                                            className='PreferenceOverridesDashboard__remove-btn'
                                                            onClick={() => toggleOverride(pref.category, pref.name)}
                                                            title='Remove override'
                                                        >
                                                            <IconX/>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {Object.keys(groupedPreferences).length === 0 && !loading && (
                            <div className='PreferenceOverridesDashboard__empty'>
                                <FormattedMessage
                                    id='admin.preference_overrides.no_preferences'
                                    defaultMessage='No user preferences found in the database. Preferences will appear here once users start customizing their settings.'
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreferenceOverridesDashboard;
