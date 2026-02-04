// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {Client4} from 'mattermost-redux/client';

import ProfilePicture from 'components/profile_picture';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import './encryption_dashboard.scss';

type EncryptionKeyWithUser = {
    session_id: string;
    user_id: string;
    username: string;
    public_key: string;
    create_at: number;
};

type EncryptionKeyStats = {
    total_keys: number;
    total_users: number;
};

type EncryptionKeysResponse = {
    keys: EncryptionKeyWithUser[];
    stats: EncryptionKeyStats;
};

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
};

// SVG Icons
const IconKey = () => (
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
        <path d='M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'/>
    </svg>
);

const IconUsers = () => (
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
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/>
        <circle cx='9' cy='7' r='4'/>
        <path d='M23 21v-2a4 4 0 0 0-3-3.87'/>
        <path d='M16 3.13a4 4 0 0 1 0 7.75'/>
    </svg>
);

const IconTrash = () => (
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
        <polyline points='3 6 5 6 21 6'/>
        <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>
    </svg>
);

const IconSearch = () => (
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
        <circle cx='11' cy='11' r='8'/>
        <line x1='21' y1='21' x2='16.65' y2='16.65'/>
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

const IconLock = () => (
    <svg
        width='48'
        height='48'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect x='3' y='11' width='18' height='11' rx='2' ry='2'/>
        <path d='M7 11V7a5 5 0 0 1 10 0v4'/>
    </svg>
);

const EncryptionDashboard: React.FC<Props> = ({config, patchConfig}) => {
    const intl = useIntl();
    const [keys, setKeys] = useState<EncryptionKeyWithUser[]>([]);
    const [stats, setStats] = useState<EncryptionKeyStats>({total_keys: 0, total_users: 0});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const isEnabled = config.FeatureFlags?.Encryption === true;

    const loadKeys = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        try {
            const response = await Client4.doFetch<EncryptionKeysResponse>(
                `${Client4.getBaseRoute()}/encryption/admin/keys`,
                {method: 'get'},
            );
            setKeys(response.keys || []);
            setStats(response.stats || {total_keys: 0, total_users: 0});
        } catch (e) {
            console.error('Failed to load encryption keys:', e);
        } finally {
            setLoading(false);
        }
    }, [isEnabled]);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const handleToggleFeature = async () => {
        try {
            // IMPORTANT: Spread existing FeatureFlags to avoid overwriting other flags
            await patchConfig({
                FeatureFlags: {
                    ...config.FeatureFlags,
                    Encryption: !isEnabled,
                },
            });
        } catch (e) {
            console.error('Failed to toggle feature:', e);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm(intl.formatMessage({
            id: 'admin.encryption.clear_confirm',
            defaultMessage: 'Are you sure you want to clear ALL encryption keys? Users will need to regenerate their keys on next login.',
        }))) {
            return;
        }

        try {
            await Client4.doFetch(
                `${Client4.getBaseRoute()}/encryption/admin/keys`,
                {method: 'delete'},
            );
            setKeys([]);
            setStats({total_keys: 0, total_users: 0});
        } catch (e) {
            console.error('Failed to clear encryption keys:', e);
        }
    };

    const handleDeleteUserKeys = async (userId: string, username: string) => {
        if (!window.confirm(intl.formatMessage({
            id: 'admin.encryption.delete_user_confirm',
            defaultMessage: 'Are you sure you want to delete all encryption keys for {username}?',
        }, {username}))) {
            return;
        }

        try {
            await Client4.doFetch(
                `${Client4.getBaseRoute()}/encryption/admin/keys/${userId}`,
                {method: 'delete'},
            );
            // Reload keys
            loadKeys();
        } catch (e) {
            console.error('Failed to delete user keys:', e);
        }
    };

    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return intl.formatMessage({id: 'admin.encryption.time.seconds', defaultMessage: '{count}s ago'}, {count: seconds});
        }
        if (minutes < 60) {
            return intl.formatMessage({id: 'admin.encryption.time.minutes', defaultMessage: '{count}m ago'}, {count: minutes});
        }
        if (hours < 24) {
            return intl.formatMessage({id: 'admin.encryption.time.hours', defaultMessage: '{count}h ago'}, {count: hours});
        }
        return intl.formatMessage({id: 'admin.encryption.time.days', defaultMessage: '{count}d ago'}, {count: days});
    };

    const filteredKeys = keys.filter((key) => {
        if (search) {
            const searchLower = search.toLowerCase();
            return (
                key.username.toLowerCase().includes(searchLower) ||
                key.user_id.toLowerCase().includes(searchLower) ||
                key.session_id.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    // Promotional card when feature is disabled
    if (!isEnabled) {
        return (
            <div className='wrapper--fixed EncryptionDashboard'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.encryption.title'
                        defaultMessage='Encryption'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='EncryptionDashboard__promotional'>
                        <div className='EncryptionDashboard__promotional__icon'>
                            <IconLock/>
                        </div>
                        <h3>
                            <FormattedMessage
                                id='admin.encryption.promo.title'
                                defaultMessage='End-to-End Encryption'
                            />
                        </h3>
                        <p>
                            <FormattedMessage
                                id='admin.encryption.promo.description'
                                defaultMessage='Enable end-to-end encryption for messages. Keys are generated per-session and messages are encrypted client-side before being sent to the server.'
                            />
                        </p>
                        <ul className='EncryptionDashboard__promotional__features'>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.encryption.promo.feature1'
                                    defaultMessage='RSA-OAEP + AES-GCM hybrid encryption'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.encryption.promo.feature2'
                                    defaultMessage='Keys generated per-session for each device'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.encryption.promo.feature3'
                                    defaultMessage='Automatic key regeneration on session loss'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.encryption.promo.feature4'
                                    defaultMessage='Manage keys from this dashboard'
                                />
                            </li>
                        </ul>
                        <button
                            className='btn btn-primary'
                            onClick={handleToggleFeature}
                        >
                            <FormattedMessage
                                id='admin.encryption.enable'
                                defaultMessage='Enable Encryption'
                            />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='wrapper--fixed EncryptionDashboard'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.encryption.title'
                    defaultMessage='Encryption'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='EncryptionDashboard__header'>
                    <h2>
                        <FormattedMessage
                            id='admin.encryption.dashboard_title'
                            defaultMessage='Encryption Key Management'
                        />
                    </h2>
                    <div className='EncryptionDashboard__header__actions'>
                        <button
                            className='btn btn-danger'
                            onClick={handleClearAll}
                            disabled={keys.length === 0}
                        >
                            <IconTrash/>
                            <FormattedMessage
                                id='admin.encryption.clear_all'
                                defaultMessage='Clear All Keys'
                            />
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className='EncryptionDashboard__stats'>
                    <div className='EncryptionDashboard__stat-card'>
                        <div className='EncryptionDashboard__stat-card__icon EncryptionDashboard__stat-card__icon--keys'>
                            <IconKey/>
                        </div>
                        <div className='EncryptionDashboard__stat-card__value'>
                            {stats.total_keys}
                        </div>
                        <div className='EncryptionDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.encryption.stat.total_keys'
                                defaultMessage='Total Keys'
                            />
                        </div>
                    </div>
                    <div className='EncryptionDashboard__stat-card'>
                        <div className='EncryptionDashboard__stat-card__icon EncryptionDashboard__stat-card__icon--users'>
                            <IconUsers/>
                        </div>
                        <div className='EncryptionDashboard__stat-card__value'>
                            {stats.total_users}
                        </div>
                        <div className='EncryptionDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.encryption.stat.total_users'
                                defaultMessage='Users with Keys'
                            />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className='EncryptionDashboard__filters'>
                    <div className='EncryptionDashboard__filters__search'>
                        <IconSearch/>
                        <input
                            type='text'
                            placeholder={intl.formatMessage({id: 'admin.encryption.search', defaultMessage: 'Search by username or ID...'})}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Key List */}
                {loading ? (
                    <div className='EncryptionDashboard__empty'>
                        <FormattedMessage
                            id='admin.encryption.loading'
                            defaultMessage='Loading keys...'
                        />
                    </div>
                ) : filteredKeys.length === 0 ? (
                    <div className='EncryptionDashboard__empty'>
                        <div className='EncryptionDashboard__empty__icon'>
                            <IconCheckCircle/>
                        </div>
                        <h4>
                            <FormattedMessage
                                id='admin.encryption.empty.title'
                                defaultMessage='No encryption keys'
                            />
                        </h4>
                        <p>
                            <FormattedMessage
                                id='admin.encryption.empty.description'
                                defaultMessage='Keys will be generated automatically when users log in with encryption enabled.'
                            />
                        </p>
                    </div>
                ) : (
                    <div className='EncryptionDashboard__list'>
                        {filteredKeys.map((key) => (
                            <div
                                key={key.session_id}
                                className='EncryptionDashboard__key-card'
                            >
                                <div className='EncryptionDashboard__key-card__user'>
                                    <ProfilePicture
                                        src={Client4.getProfilePictureUrl(key.user_id, 0)}
                                        size='sm'
                                        username={key.username}
                                    />
                                    <div className='EncryptionDashboard__key-card__user__info'>
                                        <span className='EncryptionDashboard__key-card__user__name'>
                                            {key.username}
                                        </span>
                                        <span className='EncryptionDashboard__key-card__user__id'>
                                            {key.user_id.slice(0, 8)}...
                                        </span>
                                    </div>
                                </div>
                                <div className='EncryptionDashboard__key-card__session'>
                                    Session: {key.session_id.slice(0, 12)}...
                                </div>
                                <div className='EncryptionDashboard__key-card__time'>
                                    {formatRelativeTime(key.create_at)}
                                </div>
                                <div className='EncryptionDashboard__key-card__actions'>
                                    <button
                                        className='EncryptionDashboard__key-card__action-btn'
                                        onClick={() => handleDeleteUserKeys(key.user_id, key.username)}
                                        title={intl.formatMessage({id: 'admin.encryption.delete_user_keys', defaultMessage: 'Delete all keys for this user'})}
                                    >
                                        <IconTrash/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EncryptionDashboard;
