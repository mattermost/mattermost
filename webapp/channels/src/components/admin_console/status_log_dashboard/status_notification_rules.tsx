// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {StatusNotificationRule} from '@mattermost/types/status_notification_rules';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import './status_notification_rules.scss';

// Event filter options with labels
const EVENT_FILTERS = {
    status: [
        {value: 'status_online', label: 'Went Online'},
        {value: 'status_away', label: 'Went Away'},
        {value: 'status_dnd', label: 'Went DND'},
        {value: 'status_offline', label: 'Went Offline'},
        {value: 'status_any', label: 'Any Status Change'},
    ],
    activity: [
        {value: 'activity_message', label: 'Sent a Message'},
        {value: 'activity_channel_view', label: 'Viewed a Channel'},
        {value: 'activity_window_focus', label: 'Focused Window'},
        {value: 'activity_any', label: 'Any Activity'},
    ],
    other: [
        {value: 'all', label: 'All Events'},
    ],
};

// SVG Icons
const IconPlus = () => (
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
        <line
            x1='12'
            y1='5'
            x2='12'
            y2='19'
        />
        <line
            x1='5'
            y1='12'
            x2='19'
            y2='12'
        />
    </svg>
);

const IconEdit = () => (
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
        <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/>
        <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/>
    </svg>
);

const IconTrash = () => (
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
        <polyline points='3 6 5 6 21 6'/>
        <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>
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

const IconBell = () => (
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
        <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/>
        <path d='M13.73 21a2 2 0 0 1-3.46 0'/>
    </svg>
);

type Props = {
    isEnabled: boolean;
};

type RuleFormData = {
    name: string;
    watchedUserId: string;
    watchedUsername: string;
    recipientUserId: string;
    recipientUsername: string;
    eventFilters: string[];
    enabled: boolean;
};

const initialFormData: RuleFormData = {
    name: '',
    watchedUserId: '',
    watchedUsername: '',
    recipientUserId: '',
    recipientUsername: '',
    eventFilters: [],
    enabled: true,
};

const StatusNotificationRules: React.FC<Props> = ({isEnabled}) => {
    const intl = useIntl();
    const [rules, setRules] = useState<StatusNotificationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<StatusNotificationRule | null>(null);
    const [formData, setFormData] = useState<RuleFormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [activeUserField, setActiveUserField] = useState<'watched' | 'recipient' | null>(null);
    const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});

    // Load rules on mount
    const loadRules = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const fetchedRules = await Client4.getStatusNotificationRules();
            const rulesArray = fetchedRules || [];
            setRules(rulesArray);

            // Cache user information for display
            const userIds = new Set<string>();
            rulesArray.forEach((rule) => {
                userIds.add(rule.watched_user_id);
                userIds.add(rule.recipient_user_id);
            });

            if (userIds.size > 0) {
                const users = await Client4.getProfilesByIds([...userIds]);
                const cache: Record<string, UserProfile> = {};
                (users || []).forEach((user) => {
                    cache[user.id] = user;
                });
                setUserCache(cache);
            }
        } catch (err) {
            console.error('Failed to load notification rules:', err);
        } finally {
            setLoading(false);
        }
    }, [isEnabled]);

    useEffect(() => {
        loadRules();
    }, [loadRules]);

    // Search users
    const searchUsers = useCallback(async (term: string) => {
        if (term.length < 2) {
            setUserSearchResults([]);
            return;
        }

        try {
            setSearchingUsers(true);
            const results = await Client4.searchUsers(term, {});
            setUserSearchResults(results);
        } catch (err) {
            console.error('Failed to search users:', err);
            setUserSearchResults([]);
        } finally {
            setSearchingUsers(false);
        }
    }, []);

    // Handle user search input
    const handleUserSearch = useCallback((value: string, field: 'watched' | 'recipient') => {
        setActiveUserField(field);
        if (field === 'watched') {
            setFormData((prev) => ({...prev, watchedUsername: value, watchedUserId: ''}));
        } else {
            setFormData((prev) => ({...prev, recipientUsername: value, recipientUserId: ''}));
        }
        searchUsers(value);
    }, [searchUsers]);

    // Select user from search results
    const selectUser = useCallback((user: UserProfile, field: 'watched' | 'recipient') => {
        if (field === 'watched') {
            setFormData((prev) => ({
                ...prev,
                watchedUserId: user.id,
                watchedUsername: user.username,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                recipientUserId: user.id,
                recipientUsername: user.username,
            }));
        }
        setUserSearchResults([]);
        setActiveUserField(null);
        setUserCache((prev) => ({...prev, [user.id]: user}));
    }, []);

    // Toggle event filter
    const toggleFilter = useCallback((filter: string) => {
        setFormData((prev) => {
            const current = prev.eventFilters;
            if (current.includes(filter)) {
                return {...prev, eventFilters: current.filter((f) => f !== filter)};
            }
            return {...prev, eventFilters: [...current, filter]};
        });
    }, []);

    // Open modal for creating a new rule
    const openCreateModal = useCallback(() => {
        setEditingRule(null);
        setFormData(initialFormData);
        setError(null);
        setShowModal(true);
    }, []);

    // Open modal for editing a rule
    const openEditModal = useCallback((rule: StatusNotificationRule) => {
        setEditingRule(rule);
        const watchedUser = userCache[rule.watched_user_id];
        const recipientUser = userCache[rule.recipient_user_id];
        setFormData({
            name: rule.name,
            watchedUserId: rule.watched_user_id,
            watchedUsername: watchedUser?.username || rule.watched_user_id,
            recipientUserId: rule.recipient_user_id,
            recipientUsername: recipientUser?.username || rule.recipient_user_id,
            eventFilters: rule.event_filters ? rule.event_filters.split(',').filter(Boolean) : [],
            enabled: rule.enabled,
        });
        setError(null);
        setShowModal(true);
    }, [userCache]);

    // Close modal
    const closeModal = useCallback(() => {
        setShowModal(false);
        setEditingRule(null);
        setFormData(initialFormData);
        setError(null);
        setUserSearchResults([]);
        setActiveUserField(null);
    }, []);

    // Save rule (create or update)
    const saveRule = useCallback(async () => {
        // Validation
        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }
        if (!formData.watchedUserId) {
            setError('Watched user is required');
            return;
        }
        if (!formData.recipientUserId) {
            setError('Recipient user is required');
            return;
        }
        if (formData.eventFilters.length === 0) {
            setError('At least one event filter is required');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            const ruleData = {
                name: formData.name.trim(),
                watched_user_id: formData.watchedUserId,
                recipient_user_id: formData.recipientUserId,
                event_filters: formData.eventFilters.join(','),
                enabled: formData.enabled,
            };

            if (editingRule) {
                // Update existing rule
                await Client4.updateStatusNotificationRule({
                    ...editingRule,
                    ...ruleData,
                });
            } else {
                // Create new rule
                await Client4.createStatusNotificationRule(ruleData);
            }

            await loadRules();
            closeModal();
        } catch (err: any) {
            setError(err.message || 'Failed to save rule');
        } finally {
            setSaving(false);
        }
    }, [formData, editingRule, loadRules, closeModal]);

    // Delete rule
    const deleteRule = useCallback(async (ruleId: string) => {
        if (!window.confirm('Are you sure you want to delete this notification rule?')) {
            return;
        }

        try {
            await Client4.deleteStatusNotificationRule(ruleId);
            await loadRules();
        } catch (err) {
            console.error('Failed to delete rule:', err);
        }
    }, [loadRules]);

    // Toggle rule enabled status
    const toggleRuleEnabled = useCallback(async (rule: StatusNotificationRule) => {
        try {
            await Client4.updateStatusNotificationRule({
                ...rule,
                enabled: !rule.enabled,
            });
            await loadRules();
        } catch (err) {
            console.error('Failed to toggle rule:', err);
        }
    }, [loadRules]);

    // Format event filters for display
    const formatFilters = (filterString: string) => {
        if (!filterString) {
            return 'None';
        }
        const filters = filterString.split(',').filter(Boolean);
        const allFilters = [...EVENT_FILTERS.status, ...EVENT_FILTERS.activity, ...EVENT_FILTERS.other];
        return filters.map((f) => {
            const found = allFilters.find((ef) => ef.value === f);
            return found?.label || f;
        }).join(', ');
    };

    // Get username for display
    const getUsername = (userId: string) => {
        const user = userCache[userId];
        return user ? `@${user.username}` : userId;
    };

    if (!isEnabled) {
        return (
            <div className='status-notification-rules'>
                <div className='rules-disabled'>
                    <IconBell/>
                    <FormattedMessage
                        id='admin.status_notification_rules.disabled'
                        defaultMessage='Push notification rules require Status Logs to be enabled.'
                    />
                </div>
            </div>
        );
    }

    return (
        <div className='status-notification-rules'>
            <div className='rules-header'>
                <div className='header-title'>
                    <IconBell/>
                    <h3>
                        <FormattedMessage
                            id='admin.status_notification_rules.title'
                            defaultMessage='Push Notification Rules'
                        />
                    </h3>
                </div>
                <p className='header-description'>
                    <FormattedMessage
                        id='admin.status_notification_rules.description'
                        defaultMessage='Configure push notifications when watched users change status or have activity.'
                    />
                </p>
                <button
                    className='btn btn-primary add-rule-btn'
                    onClick={openCreateModal}
                >
                    <IconPlus/>
                    <FormattedMessage
                        id='admin.status_notification_rules.add'
                        defaultMessage='Add Rule'
                    />
                </button>
            </div>

            {loading ? (
                <div className='rules-loading'>
                    <FormattedMessage
                        id='admin.status_notification_rules.loading'
                        defaultMessage='Loading rules...'
                    />
                </div>
            ) : rules.length === 0 ? (
                <div className='rules-empty'>
                    <FormattedMessage
                        id='admin.status_notification_rules.empty'
                        defaultMessage='No notification rules configured. Click "Add Rule" to create one.'
                    />
                </div>
            ) : (
                <div className='rules-table'>
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.table.name'
                                        defaultMessage='Name'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.table.watched'
                                        defaultMessage='Watched User'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.table.recipient'
                                        defaultMessage='Notify'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.table.events'
                                        defaultMessage='Events'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.table.enabled'
                                        defaultMessage='Enabled'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.table.actions'
                                        defaultMessage='Actions'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map((rule) => (
                                <tr key={rule.id}>
                                    <td className='rule-name'>{rule.name}</td>
                                    <td className='rule-user'>{getUsername(rule.watched_user_id)}</td>
                                    <td className='rule-user'>{getUsername(rule.recipient_user_id)}</td>
                                    <td className='rule-events'>{formatFilters(rule.event_filters)}</td>
                                    <td className='rule-enabled'>
                                        <label className='toggle-switch'>
                                            <input
                                                type='checkbox'
                                                checked={rule.enabled}
                                                onChange={() => toggleRuleEnabled(rule)}
                                            />
                                            <span className='toggle-slider'/>
                                        </label>
                                    </td>
                                    <td className='rule-actions'>
                                        <button
                                            className='btn btn-icon'
                                            title={intl.formatMessage({id: 'admin.status_notification_rules.edit', defaultMessage: 'Edit'})}
                                            onClick={() => openEditModal(rule)}
                                        >
                                            <IconEdit/>
                                        </button>
                                        <button
                                            className='btn btn-icon btn-danger'
                                            title={intl.formatMessage({id: 'admin.status_notification_rules.delete', defaultMessage: 'Delete'})}
                                            onClick={() => deleteRule(rule.id)}
                                        >
                                            <IconTrash/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal for Create/Edit Rule */}
            {showModal && (
                <div className='rules-modal-overlay'>
                    <div className='rules-modal'>
                        <div className='modal-header'>
                            <h4>
                                {editingRule ? (
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.edit'
                                        defaultMessage='Edit Notification Rule'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.create'
                                        defaultMessage='Create Notification Rule'
                                    />
                                )}
                            </h4>
                            <button
                                className='btn btn-icon'
                                onClick={closeModal}
                            >
                                <IconX/>
                            </button>
                        </div>

                        <div className='modal-body'>
                            {error && (
                                <div className='error-message'>{error}</div>
                            )}

                            <div className='form-group'>
                                <label>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.name'
                                        defaultMessage='Rule Name'
                                    />
                                </label>
                                <input
                                    type='text'
                                    className='form-control'
                                    value={formData.name}
                                    onChange={(e) => setFormData((prev) => ({...prev, name: e.target.value}))}
                                    placeholder={intl.formatMessage({id: 'admin.status_notification_rules.modal.name.placeholder', defaultMessage: 'e.g., Notify me when John is online'})}
                                />
                            </div>

                            <div className='form-group'>
                                <label>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.watched_user'
                                        defaultMessage='Watched User'
                                    />
                                </label>
                                <div className='user-search-container'>
                                    <input
                                        type='text'
                                        className='form-control'
                                        value={formData.watchedUsername}
                                        onChange={(e) => handleUserSearch(e.target.value, 'watched')}
                                        placeholder={intl.formatMessage({id: 'admin.status_notification_rules.modal.search_user', defaultMessage: 'Search for a user...'})}
                                    />
                                    {activeUserField === 'watched' && userSearchResults.length > 0 && (
                                        <div className='user-search-results'>
                                            {userSearchResults.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className='user-search-result'
                                                    onClick={() => selectUser(user, 'watched')}
                                                >
                                                    <span className='username'>@{user.username}</span>
                                                    {user.first_name && user.last_name && (
                                                        <span className='fullname'>
                                                            {user.first_name} {user.last_name}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className='form-group'>
                                <label>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.recipient_user'
                                        defaultMessage='Notify User'
                                    />
                                </label>
                                <div className='user-search-container'>
                                    <input
                                        type='text'
                                        className='form-control'
                                        value={formData.recipientUsername}
                                        onChange={(e) => handleUserSearch(e.target.value, 'recipient')}
                                        placeholder={intl.formatMessage({id: 'admin.status_notification_rules.modal.search_user', defaultMessage: 'Search for a user...'})}
                                    />
                                    {activeUserField === 'recipient' && userSearchResults.length > 0 && (
                                        <div className='user-search-results'>
                                            {userSearchResults.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className='user-search-result'
                                                    onClick={() => selectUser(user, 'recipient')}
                                                >
                                                    <span className='username'>@{user.username}</span>
                                                    {user.first_name && user.last_name && (
                                                        <span className='fullname'>
                                                            {user.first_name} {user.last_name}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className='form-group'>
                                <label>
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.events'
                                        defaultMessage='Trigger Events'
                                    />
                                </label>
                                <div className='event-filters'>
                                    <div className='filter-group'>
                                        <h5>
                                            <FormattedMessage
                                                id='admin.status_notification_rules.modal.status_changes'
                                                defaultMessage='Status Changes'
                                            />
                                        </h5>
                                        {EVENT_FILTERS.status.map((filter) => (
                                            <label
                                                key={filter.value}
                                                className='filter-checkbox'
                                            >
                                                <input
                                                    type='checkbox'
                                                    checked={formData.eventFilters.includes(filter.value)}
                                                    onChange={() => toggleFilter(filter.value)}
                                                />
                                                <span>{filter.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className='filter-group'>
                                        <h5>
                                            <FormattedMessage
                                                id='admin.status_notification_rules.modal.activity_events'
                                                defaultMessage='Activity Events'
                                            />
                                        </h5>
                                        {EVENT_FILTERS.activity.map((filter) => (
                                            <label
                                                key={filter.value}
                                                className='filter-checkbox'
                                            >
                                                <input
                                                    type='checkbox'
                                                    checked={formData.eventFilters.includes(filter.value)}
                                                    onChange={() => toggleFilter(filter.value)}
                                                />
                                                <span>{filter.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className='filter-group'>
                                        <h5>
                                            <FormattedMessage
                                                id='admin.status_notification_rules.modal.other'
                                                defaultMessage='Other'
                                            />
                                        </h5>
                                        {EVENT_FILTERS.other.map((filter) => (
                                            <label
                                                key={filter.value}
                                                className='filter-checkbox'
                                            >
                                                <input
                                                    type='checkbox'
                                                    checked={formData.eventFilters.includes(filter.value)}
                                                    onChange={() => toggleFilter(filter.value)}
                                                />
                                                <span>{filter.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className='form-group'>
                                <label className='filter-checkbox'>
                                    <input
                                        type='checkbox'
                                        checked={formData.enabled}
                                        onChange={(e) => setFormData((prev) => ({...prev, enabled: e.target.checked}))}
                                    />
                                    <span>
                                        <FormattedMessage
                                            id='admin.status_notification_rules.modal.enabled'
                                            defaultMessage='Rule Enabled'
                                        />
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className='modal-footer'>
                            <button
                                className='btn btn-secondary'
                                onClick={closeModal}
                                disabled={saving}
                            >
                                <FormattedMessage
                                    id='admin.status_notification_rules.modal.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                            <button
                                className='btn btn-primary'
                                onClick={saveRule}
                                disabled={saving}
                            >
                                {saving ? (
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.saving'
                                        defaultMessage='Saving...'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='admin.status_notification_rules.modal.save'
                                        defaultMessage='Save Rule'
                                    />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusNotificationRules;
