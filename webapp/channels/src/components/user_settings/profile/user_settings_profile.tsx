// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AIGeneratedProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

import './user_settings_profile.scss';

type Props = {
    closeModal: () => void;
    collapseModal: () => void;
};

const UserSettingsProfile: React.FC<Props> = ({closeModal, collapseModal}) => {
    const intl = useIntl();
    const currentUserId = useSelector(getCurrentUserId);

    const [profile, setProfile] = useState<AIGeneratedProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        fetchProfile();
    }, [currentUserId]);

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await Client4.getUserProfile(currentUserId);
            setProfile(result);
        } catch (err: any) {
            // Profile might not exist yet, which is fine
            if (err?.status_code !== 404) {
                setError(err?.message || 'Failed to load profile');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateProfile = async () => {
        setGenerating(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const result = await Client4.generateUserProfile(currentUserId);
            setProfile(result);
            setSuccessMessage(intl.formatMessage({
                id: 'user.settings.profile.generateSuccess',
                defaultMessage: 'Profile generated successfully!',
            }));
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err?.message || intl.formatMessage({
                id: 'user.settings.profile.generateError',
                defaultMessage: 'Failed to generate profile. Please try again.',
            }));
        } finally {
            setGenerating(false);
        }
    };

    const formatTimestamp = (timestamp: number) => {
        if (!timestamp) {
            return '';
        }
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return intl.formatMessage({
                id: 'user.settings.profile.justNow',
                defaultMessage: 'just now',
            });
        }
        if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return intl.formatMessage({
                id: 'user.settings.profile.minutesAgo',
                defaultMessage: '{minutes, plural, one {# minute ago} other {# minutes ago}}',
            }, {minutes});
        }
        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return intl.formatMessage({
                id: 'user.settings.profile.hoursAgo',
                defaultMessage: '{hours, plural, one {# hour ago} other {# hours ago}}',
            }, {hours});
        }
        const days = Math.floor(diffInSeconds / 86400);
        if (days < 30) {
            return intl.formatMessage({
                id: 'user.settings.profile.daysAgo',
                defaultMessage: '{days, plural, one {# day ago} other {# days ago}}',
            }, {days});
        }
        const months = Math.floor(days / 30);
        if (months < 12) {
            return intl.formatMessage({
                id: 'user.settings.profile.monthsAgo',
                defaultMessage: '{months, plural, one {# month ago} other {# months ago}}',
            }, {months});
        }
        const years = Math.floor(days / 365);
        return intl.formatMessage({
            id: 'user.settings.profile.yearsAgo',
            defaultMessage: '{years, plural, one {# year ago} other {# years ago}}',
        }, {years});
    };

    const renderEmptyState = () => (
        <div className='profile-empty-state'>
            <div className='profile-empty-state__content'>
                <p className='profile-empty-state__text'>
                    <FormattedMessage
                        id='user.settings.profile.noProfile'
                        defaultMessage='No AI-generated profile exists yet. Generate a profile to see an AI-powered analysis of your writing style and topics of interest based on your messages.'
                    />
                </p>
                <button
                    className='btn btn-primary'
                    onClick={handleGenerateProfile}
                    disabled={generating}
                >
                    <LoadingWrapper
                        loading={generating}
                        text={intl.formatMessage({
                            id: 'user.settings.profile.generating',
                            defaultMessage: 'Generating...',
                        })}
                    >
                        <FormattedMessage
                            id='user.settings.profile.generateButton'
                            defaultMessage='Generate Profile'
                        />
                    </LoadingWrapper>
                </button>
            </div>
        </div>
    );

    const renderProfile = () => {
        if (!profile) {
            return null;
        }

        return (
            <div className='profile-content'>
                {/* Timestamp */}
                {profile.generated_at && (
                    <div className='profile-timestamp'>
                        <FormattedMessage
                            id='user.settings.profile.generatedAt'
                            defaultMessage='Generated {time}'
                            values={{
                                time: formatTimestamp(profile.generated_at),
                            }}
                        />
                    </div>
                )}

                {/* Writing Style Report Section */}
                {profile.writing_style_report && (
                    <div className='profile-section'>
                        <h4 className='profile-section__title'>
                            <FormattedMessage
                                id='user.settings.profile.writingStyle'
                                defaultMessage='Writing Style Analysis'
                            />
                        </h4>
                        <div className='profile-section__content'>
                            <p className='writing-style-report'>
                                {profile.writing_style_report}
                            </p>
                        </div>
                    </div>
                )}

                {/* Topics Section */}
                {profile.topics && profile.topics.length > 0 && (
                    <div className='profile-section'>
                        <h4 className='profile-section__title'>
                            <FormattedMessage
                                id='user.settings.profile.topicsInterests'
                                defaultMessage='Topics & Interests'
                            />
                        </h4>
                        <div className='profile-section__content'>
                            <div className='profile-badges'>
                                {profile.topics.map((topic, index) => (
                                    <span
                                        key={index}
                                        className='badge badge-info profile-badge'
                                    >
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Regenerate Button */}
                <div className='profile-actions'>
                    <button
                        className='btn btn-secondary'
                        onClick={handleGenerateProfile}
                        disabled={generating}
                    >
                        <LoadingWrapper
                            loading={generating}
                            text={intl.formatMessage({
                                id: 'user.settings.profile.regenerating',
                                defaultMessage: 'Regenerating...',
                            })}
                        >
                            <FormattedMessage
                                id='user.settings.profile.regenerateButton'
                                defaultMessage='Regenerate Profile'
                            />
                        </LoadingWrapper>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div
            id='profileSettings'
            aria-labelledby='profileButton'
            role='tabpanel'
        >
            <SettingMobileHeader
                closeModal={closeModal}
                collapseModal={collapseModal}
                text={
                    <FormattedMessage
                        id='user.settings.profile.title'
                        defaultMessage='AI Profile'
                    />
                }
            />
            <div className='user-settings'>
                <SettingDesktopHeader
                    id='profileSettingsTitle'
                    text={
                        <FormattedMessage
                            id='user.settings.profile.title'
                            defaultMessage='AI Profile'
                        />
                    }
                />
                <div className='divider-dark first'/>

                {/* Error Message */}
                {error && (
                    <div className='alert alert-danger'>
                        <i className='icon icon-alert-outline'/>
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div className='alert alert-success'>
                        <i className='icon icon-check'/>
                        {successMessage}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className='profile-loading'>
                        <LoadingWrapper
                            loading={true}
                            text={intl.formatMessage({
                                id: 'user.settings.profile.loading',
                                defaultMessage: 'Loading profile...',
                            })}
                        >
                            <div/>
                        </LoadingWrapper>
                    </div>
                )}

                {/* Content */}
                {!loading && (
                    <>
                        {profile ? renderProfile() : renderEmptyState()}
                    </>
                )}
            </div>
        </div>
    );
};

export default UserSettingsProfile;
