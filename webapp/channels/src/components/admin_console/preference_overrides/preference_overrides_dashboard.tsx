// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {Client4} from 'mattermost-redux/client';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {
    getPreferenceDefinition,
    getPreferenceGroup,
    PREFERENCE_GROUP_INFO,
    PreferenceGroups,
} from 'utils/preference_definitions';
import type {PreferenceGroup} from 'utils/preference_definitions';

import './preference_overrides_dashboard.scss';

type PreferenceKey = {
    category: string;
    name: string;
    values?: string[];
};

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
};

// Convert snake_case or kebab-case to Title Case
// e.g., "haptic_feedback_enabled" -> "Haptic Feedback Enabled"
// e.g., "use_military_time" -> "Use Military Time"
const toTitleCase = (str: string): string => {
    return str
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
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

const IconCheckCircle = () => (
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
        <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/>
        <polyline points='22 4 12 14.01 9 11.01'/>
    </svg>
);

const IconSettings = () => (
    <svg
        width='20'
        height='20'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <circle
            cx='12'
            cy='12'
            r='3'
        />
        <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/>
    </svg>
);

const IconPush = () => (
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
        <path d='M12 19V5'/>
        <polyline points='5 12 12 5 19 12'/>
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

    // Push preference state
    const [pushingKey, setPushingKey] = useState<string | null>(null);
    const [pushValue, setPushValue] = useState('');
    const [pushOverwrite, setPushOverwrite] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [pushResult, setPushResult] = useState<{key: string; count: number} | null>(null);

    // Check if features are enabled
    // PreferencesRevamp is required for the shared definitions
    // PreferenceOverridesDashboard enables this admin dashboard
    const preferencesRevampEnabled = config.FeatureFlags?.PreferencesRevamp === true;
    const dashboardEnabled = config.FeatureFlags?.PreferenceOverridesDashboard === true;
    const isEnabled = preferencesRevampEnabled && dashboardEnabled;

    // Load current overrides from config
    useEffect(() => {
        const currentOverrides = config.MattermostExtendedSettings?.Preferences?.Overrides || {};
        setOverrides({...currentOverrides});
    }, [config.MattermostExtendedSettings?.Preferences?.Overrides]);

    // Load available preferences from database
    const loadPreferences = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }
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
    }, [intl, isEnabled]);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // Toggle feature on/off
    const handleToggleFeature = async () => {
        try {
            // IMPORTANT: Spread existing FeatureFlags to avoid overwriting other flags
            // Enable both PreferencesRevamp (required) and PreferenceOverridesDashboard
            await patchConfig({
                FeatureFlags: {
                    ...config.FeatureFlags,
                    PreferencesRevamp: !isEnabled ? true : config.FeatureFlags?.PreferencesRevamp,
                    PreferenceOverridesDashboard: !isEnabled,
                },
            });
        } catch (e) {
            console.error('Failed to toggle feature:', e);
        }
    };

    // Check if SettingsResorted feature flag is enabled
    const settingsResorted = config.FeatureFlags?.SettingsResorted === true;

    // Group preferences - by SettingsResorted group when enabled, otherwise by category
    const groupedPreferences = useMemo(() => {
        if (settingsResorted) {
            // Group by SettingsResorted groups
            const groups: Record<PreferenceGroup, PreferenceKey[]> = {
                [PreferenceGroups.TIME_DATE]: [],
                [PreferenceGroups.TEAMMATES]: [],
                [PreferenceGroups.MESSAGES]: [],
                [PreferenceGroups.CHANNEL]: [],
                [PreferenceGroups.NOTIFICATIONS]: [],
                [PreferenceGroups.ADVANCED]: [],
                [PreferenceGroups.SIDEBAR]: [],
                [PreferenceGroups.THEME]: [],
                [PreferenceGroups.LANGUAGE]: [],
            };

            availablePreferences.forEach((pref) => {
                const group = getPreferenceGroup(pref.category, pref.name);
                if (group && groups[group]) {
                    groups[group].push(pref);
                } else {
                    // Unknown preferences go to advanced
                    groups[PreferenceGroups.ADVANCED].push(pref);
                }
            });

            // Sort preferences within each group by their defined order
            Object.keys(groups).forEach((group) => {
                groups[group as PreferenceGroup].sort((a, b) => {
                    const defA = getPreferenceDefinition(a.category, a.name);
                    const defB = getPreferenceDefinition(b.category, b.name);
                    const orderA = defA?.order ?? 999;
                    const orderB = defB?.order ?? 999;
                    return orderA - orderB;
                });
            });

            // Filter out empty groups and return as array sorted by group order
            return Object.entries(groups)
                .filter(([_, prefs]) => prefs.length > 0)
                .sort(([groupA], [groupB]) => {
                    const orderA = PREFERENCE_GROUP_INFO[groupA as PreferenceGroup]?.order ?? 999;
                    const orderB = PREFERENCE_GROUP_INFO[groupB as PreferenceGroup]?.order ?? 999;
                    return orderA - orderB;
                })
                .reduce((acc, [group, prefs]) => {
                    acc[group] = prefs;
                    return acc;
                }, {} as Record<string, PreferenceKey[]>);
        }

        // Default: group by category
        const groups: Record<string, PreferenceKey[]> = {};
        availablePreferences.forEach((pref) => {
            if (!groups[pref.category]) {
                groups[pref.category] = [];
            }
            groups[pref.category].push(pref);
        });

        // Sort preferences within each category alphabetically
        Object.values(groups).forEach((prefs) => {
            prefs.sort((a, b) => a.name.localeCompare(b.name));
        });

        return groups;
    }, [availablePreferences, settingsResorted]);

    // Check if a preference is currently overridden
    const isOverridden = (category: string, name: string): boolean => {
        const key = `${category}:${name}`;
        return key in overrides;
    };

    // Get the title for a preference from shared definitions
    const getPreferenceTitle = (category: string, name: string): string => {
        const definition = getPreferenceDefinition(category, name);
        if (definition) {
            return intl.formatMessage(definition.title);
        }
        return toTitleCase(name);
    };

    // Get the description for a preference from shared definitions
    const getPreferenceDescription = (category: string, name: string): string | undefined => {
        const definition = getPreferenceDefinition(category, name);
        if (definition) {
            return intl.formatMessage(definition.description);
        }
        return undefined;
    };

    // Get options for a preference from shared definitions
    // Returns null for unknown preferences (will show free-form text input)
    const getPreferenceOptions = (category: string, name: string): Array<{value: string; label: string}> | null => {
        const definition = getPreferenceDefinition(category, name);
        if (definition) {
            return definition.options.map((opt) => ({
                value: opt.value,
                label: intl.formatMessage(opt.label),
            }));
        }
        // Unknown preference - return null to show text input
        return null;
    };

    // Get the default value for a preference from shared definitions
    const getPreferenceDefaultValue = (category: string, name: string): string => {
        const definition = getPreferenceDefinition(category, name);
        if (definition) {
            return definition.defaultValue;
        }
        return '';
    };

    // Toggle override for a preference
    const toggleOverride = (category: string, name: string) => {
        const key = `${category}:${name}`;
        setOverrides((prev) => {
            const newOverrides = {...prev};
            if (key in newOverrides) {
                delete newOverrides[key];
            } else {
                // Get default value from shared definitions, or first option, or empty string
                const defaultValue = getPreferenceDefaultValue(category, name) ||
                    getPreferenceOptions(category, name)?.[0]?.value ||
                    '';
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

    // Open push panel for a preference
    const openPushPanel = (category: string, name: string) => {
        const key = `${category}:${name}`;
        setPushingKey(key);
        setPushValue(getPreferenceDefaultValue(category, name) || getPreferenceOptions(category, name)?.[0]?.value || '');
        setPushOverwrite(false);
        setPushResult(null);
    };

    // Close push panel
    const closePushPanel = () => {
        setPushingKey(null);
        setPushValue('');
        setPushOverwrite(false);
        setPushResult(null);
    };

    // Execute push
    const handlePush = async () => {
        if (!pushingKey) {
            return;
        }
        const parts = pushingKey.split(':');
        if (parts.length < 2) {
            return;
        }
        const category = parts[0];
        const name = parts.slice(1).join(':');

        setPushing(true);
        setError(null);
        try {
            const result = await Client4.pushPreferenceToAllUsers(category, name, pushValue, pushOverwrite);
            setPushResult({key: pushingKey, count: result.affected_users});
        } catch (e) {
            console.error('Failed to push preference:', e);
            setError(intl.formatMessage({
                id: 'admin.preference_overrides.error.push',
                defaultMessage: 'Failed to push preference to users.',
            }));
        } finally {
            setPushing(false);
        }
    };

    // Count active overrides
    const activeOverrideCount = Object.keys(overrides).length;

    // Promotional view when feature is disabled
    if (!isEnabled) {
        return (
            <div className='wrapper--fixed PreferenceOverridesDashboard'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.sidebar.user_preferences'
                        defaultMessage='User Preferences'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='PreferenceOverridesDashboard__promotional'>
                        <div className='PreferenceOverridesDashboard__promotional__icon'>
                            <IconSettings/>
                        </div>
                        <h3>
                            <FormattedMessage
                                id='admin.preference_overrides.promo.title'
                                defaultMessage='Preference Overrides'
                            />
                        </h3>
                        <p>
                            <FormattedMessage
                                id='admin.preference_overrides.promo.description'
                                defaultMessage='Take control of user preferences across your workspace. Override settings for all users and enforce consistent configurations.'
                            />
                        </p>
                        <ul className='PreferenceOverridesDashboard__promotional__features'>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.preference_overrides.promo.feature1'
                                    defaultMessage='Enforce display settings like clock format and message display'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.preference_overrides.promo.feature2'
                                    defaultMessage='Control notification preferences for all users'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.preference_overrides.promo.feature3'
                                    defaultMessage='Overridden settings are hidden from users automatically'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.preference_overrides.promo.feature4'
                                    defaultMessage='Discover all preferences in use across your workspace'
                                />
                            </li>
                        </ul>
                        <button
                            className='btn btn-primary'
                            onClick={handleToggleFeature}
                        >
                            <FormattedMessage
                                id='admin.preference_overrides.enable'
                                defaultMessage='Enable Preference Overrides Dashboard'
                            />
                        </button>
                        {!preferencesRevampEnabled && (
                            <p className='PreferenceOverridesDashboard__promotional__note'>
                                <FormattedMessage
                                    id='admin.preference_overrides.promo.note'
                                    defaultMessage='This will also enable the Preferences Revamp feature flag.'
                                />
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

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
                                    <h3>
                                        {settingsResorted && PREFERENCE_GROUP_INFO[category as PreferenceGroup] ? (
                                            intl.formatMessage(PREFERENCE_GROUP_INFO[category as PreferenceGroup].title)
                                        ) : (
                                            toTitleCase(category)
                                        )}
                                    </h3>
                                    <span className='PreferenceOverridesDashboard__category-count'>
                                        {prefs.filter((p) => isOverridden(p.category, p.name)).length} / {prefs.length}
                                    </span>
                                </div>
                                <div className='PreferenceOverridesDashboard__preferences'>
                                    {prefs.map((pref) => {
                                        const key = `${pref.category}:${pref.name}`;
                                        const overridden = isOverridden(pref.category, pref.name);
                                        const options = getPreferenceOptions(pref.category, pref.name);

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
                                                            {getPreferenceTitle(pref.category, pref.name)}
                                                        </span>
                                                        {getPreferenceDescription(pref.category, pref.name) && (
                                                            <span className='PreferenceOverridesDashboard__preference-description'>
                                                                {getPreferenceDescription(pref.category, pref.name)}
                                                            </span>
                                                        )}
                                                        <span className='PreferenceOverridesDashboard__preference-key'>
                                                            {pref.category}:{pref.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        className={`PreferenceOverridesDashboard__push-btn ${pushingKey === key ? 'active' : ''}`}
                                                        onClick={() => pushingKey === key ? closePushPanel() : openPushPanel(pref.category, pref.name)}
                                                        title={intl.formatMessage({
                                                            id: 'admin.preference_overrides.push.tooltip',
                                                            defaultMessage: 'Push value to all users',
                                                        })}
                                                    >
                                                        <IconPush/>
                                                    </button>
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
                                                {pushingKey === key && (
                                                    <div className='PreferenceOverridesDashboard__push-panel'>
                                                        <div className='PreferenceOverridesDashboard__push-panel-header'>
                                                            <IconPush/>
                                                            <FormattedMessage
                                                                id='admin.preference_overrides.push.title'
                                                                defaultMessage='Push to All Users'
                                                            />
                                                        </div>
                                                        <p className='PreferenceOverridesDashboard__push-panel-hint'>
                                                            <FormattedMessage
                                                                id='admin.preference_overrides.push.hint'
                                                                defaultMessage='This writes the value directly to the database for all active users. Users can still change it later.'
                                                            />
                                                        </p>
                                                        <div className='PreferenceOverridesDashboard__push-panel-controls'>
                                                            {options ? (
                                                                <select
                                                                    value={pushValue}
                                                                    onChange={(e) => setPushValue(e.target.value)}
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
                                                                    value={pushValue}
                                                                    onChange={(e) => setPushValue(e.target.value)}
                                                                    placeholder={intl.formatMessage({
                                                                        id: 'admin.preference_overrides.push.value_placeholder',
                                                                        defaultMessage: 'Value to push...',
                                                                    })}
                                                                />
                                                            )}
                                                        </div>
                                                        <label className='PreferenceOverridesDashboard__push-panel-checkbox'>
                                                            <input
                                                                type='checkbox'
                                                                checked={pushOverwrite}
                                                                onChange={(e) => setPushOverwrite(e.target.checked)}
                                                            />
                                                            <FormattedMessage
                                                                id='admin.preference_overrides.push.overwrite'
                                                                defaultMessage='Overwrite existing values'
                                                            />
                                                            <span className='PreferenceOverridesDashboard__push-panel-checkbox-hint'>
                                                                <FormattedMessage
                                                                    id='admin.preference_overrides.push.overwrite_hint'
                                                                    defaultMessage={"If unchecked, only users who haven't set this preference will be affected"}
                                                                />
                                                            </span>
                                                        </label>
                                                        <div className='PreferenceOverridesDashboard__push-panel-actions'>
                                                            <button
                                                                className='btn btn-primary'
                                                                onClick={handlePush}
                                                                disabled={pushing || !pushValue}
                                                            >
                                                                {pushing ? (
                                                                    <FormattedMessage
                                                                        id='admin.preference_overrides.push.pushing'
                                                                        defaultMessage='Pushing...'
                                                                    />
                                                                ) : (
                                                                    <>
                                                                        <IconPush/>
                                                                        <FormattedMessage
                                                                            id='admin.preference_overrides.push.execute'
                                                                            defaultMessage='Push to All Users'
                                                                        />
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                className='btn btn-tertiary'
                                                                onClick={closePushPanel}
                                                            >
                                                                <FormattedMessage
                                                                    id='admin.preference_overrides.push.cancel'
                                                                    defaultMessage='Cancel'
                                                                />
                                                            </button>
                                                        </div>
                                                        {pushResult && pushResult.key === key && (
                                                            <div className='PreferenceOverridesDashboard__push-panel-result'>
                                                                <IconCheckCircle/>
                                                                <FormattedMessage
                                                                    id='admin.preference_overrides.push.result'
                                                                    defaultMessage='Successfully updated {count} {count, plural, one {user} other {users}}.'
                                                                    values={{count: pushResult.count}}
                                                                />
                                                            </div>
                                                        )}
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
