// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import CopyButton from 'components/copy_button';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import useAITheme from 'hooks/use_ai_theme';

import ThemeThumbnail from '../theme_thumbnail';

import './ai_theme_chooser.scss';

type Props = {
    theme: Theme;
    updateTheme: (theme: Theme) => void;
};

const AIThemeChooser: React.FC<Props> = ({theme, updateTheme}) => {
    const intl = useIntl();
    const {
        aiTheme,
        generating,
        error,
        successMessage,
        themePreference,
        setThemePreference,
        generateAITheme,
        clearMessages,
    } = useAITheme();

    useEffect(() => {
        // This effect can be used for future functionality
    }, [successMessage]);

    const handleGenerateTheme = async () => {
        clearMessages();
        await generateAITheme();
    };

    const handleApplyTheme = () => {
        if (aiTheme) {
            updateTheme(aiTheme.theme);
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
                id: 'user.settings.theme.ai.justNow',
                defaultMessage: 'just now',
            });
        }
        if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return intl.formatMessage({
                id: 'user.settings.theme.ai.minutesAgo',
                defaultMessage: '{minutes, plural, one {# minute ago} other {# minutes ago}}',
            }, {minutes});
        }
        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return intl.formatMessage({
                id: 'user.settings.theme.ai.hoursAgo',
                defaultMessage: '{hours, plural, one {# hour ago} other {# hours ago}}',
            }, {hours});
        }
        const days = Math.floor(diffInSeconds / 86400);
        if (days < 30) {
            return intl.formatMessage({
                id: 'user.settings.theme.ai.daysAgo',
                defaultMessage: '{days, plural, one {# day ago} other {# days ago}}',
            }, {days});
        }
        const months = Math.floor(days / 30);
        if (months < 12) {
            return intl.formatMessage({
                id: 'user.settings.theme.ai.monthsAgo',
                defaultMessage: '{months, plural, one {# month ago} other {# months ago}}',
            }, {months});
        }
        const years = Math.floor(days / 365);
        return intl.formatMessage({
            id: 'user.settings.theme.ai.yearsAgo',
            defaultMessage: '{years, plural, one {# year ago} other {# years ago}}',
        }, {years});
    };

    const renderEmptyState = () => (
        <div className='ai-theme-empty-state'>
            <div className='ai-theme-empty-state__content'>
                <div className='ai-theme-empty-state__icon'>
                    <i className='icon icon-robot'/>
                </div>
                <h4 className='ai-theme-empty-state__title'>
                    <FormattedMessage
                        id='user.settings.theme.ai.noTheme'
                        defaultMessage='No AI-generated theme yet'
                    />
                </h4>
                <p className='ai-theme-empty-state__text'>
                    <FormattedMessage
                        id='user.settings.theme.ai.noThemeDescription'
                        defaultMessage='Generate a personalized theme based on your AI profile. The theme will be created using your writing style and topics of interest.'
                    />
                </p>

                {/* Theme Preference Selection */}
                <div className='ai-theme-preference-selection'>
                    <h5 className='ai-theme-preference-selection__title'>
                        <FormattedMessage
                            id='user.settings.theme.ai.themePreference'
                            defaultMessage='Theme Preference'
                        />
                    </h5>
                    <div className='ai-theme-preference-selection__options'>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    type='radio'
                                    name='themePreference'
                                    value='light'
                                    checked={themePreference === 'light'}
                                    onChange={(e) => setThemePreference(e.target.value as 'light' | 'dark' | 'auto')}
                                />
                                <FormattedMessage
                                    id='user.settings.theme.ai.lightTheme'
                                    defaultMessage='Light Theme'
                                />
                            </label>
                        </div>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    type='radio'
                                    name='themePreference'
                                    value='dark'
                                    checked={themePreference === 'dark'}
                                    onChange={(e) => setThemePreference(e.target.value as 'light' | 'dark' | 'auto')}
                                />
                                <FormattedMessage
                                    id='user.settings.theme.ai.darkTheme'
                                    defaultMessage='Dark Theme'
                                />
                            </label>
                        </div>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    type='radio'
                                    name='themePreference'
                                    value='auto'
                                    checked={themePreference === 'auto'}
                                    onChange={(e) => setThemePreference(e.target.value as 'light' | 'dark' | 'auto')}
                                />
                                <FormattedMessage
                                    id='user.settings.theme.ai.autoTheme'
                                    defaultMessage='Auto (Let AI Decide)'
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <button
                    className='btn btn-primary'
                    onClick={handleGenerateTheme}
                    disabled={generating}
                >
                    <LoadingWrapper
                        loading={generating}
                        text={intl.formatMessage({
                            id: 'user.settings.theme.ai.generating',
                            defaultMessage: 'Generating...',
                        })}
                    >
                        <FormattedMessage
                            id='user.settings.theme.ai.generateButton'
                            defaultMessage='Generate AI Theme'
                        />
                    </LoadingWrapper>
                </button>
            </div>
        </div>
    );

    const renderAITheme = () => {
        if (!aiTheme) {
            return null;
        }

        const isActive = aiTheme.theme.type === theme.type;

        return (
            <div className='ai-theme-content'>
                {/* Timestamp */}
                {aiTheme.generated_at && (
                    <div className='ai-theme-timestamp'>
                        <FormattedMessage
                            id='user.settings.theme.ai.generatedAt'
                            defaultMessage='Generated {time}'
                            values={{
                                time: formatTimestamp(aiTheme.generated_at),
                            }}
                        />
                    </div>
                )}

                {/* Theme Preview */}
                <div className='ai-theme-preview'>
                    <div className='ai-theme-preview__header'>
                        <h4 className='ai-theme-preview__title'>
                            <FormattedMessage
                                id='user.settings.theme.ai.preview'
                                defaultMessage='AI-Generated Theme Preview'
                            />
                        </h4>
                        <div className='ai-theme-preview__actions'>
                            <button
                                className={`btn ${isActive ? 'btn-success' : 'btn-primary'}`}
                                onClick={handleApplyTheme}
                                disabled={isActive}
                            >
                                {isActive ? (
                                    <FormattedMessage
                                        id='user.settings.theme.ai.applied'
                                        defaultMessage='Applied'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='user.settings.theme.ai.apply'
                                        defaultMessage='Apply Theme'
                                    />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className='ai-theme-preview__thumbnail'>
                        <ThemeThumbnail
                            themeKey='ai-generated'
                            themeName={aiTheme.theme.type || 'AI Generated'}
                            sidebarBg={aiTheme.theme.sidebarBg}
                            sidebarText={aiTheme.theme.sidebarText}
                            sidebarUnreadText={aiTheme.theme.sidebarUnreadText}
                            onlineIndicator={aiTheme.theme.onlineIndicator}
                            awayIndicator={aiTheme.theme.awayIndicator}
                            dndIndicator={aiTheme.theme.dndIndicator}
                            centerChannelColor={aiTheme.theme.centerChannelColor}
                            centerChannelBg={aiTheme.theme.centerChannelBg}
                            newMessageSeparator={aiTheme.theme.newMessageSeparator}
                            buttonBg={aiTheme.theme.buttonBg}
                        />
                    </div>
                </div>

                {/* Theme Explanation */}
                {aiTheme.explanation && (
                    <div className='ai-theme-explanation'>
                        <div className='ai-theme-explanation__header'>
                            <h4 className='ai-theme-explanation__title'>
                                <FormattedMessage
                                    id='user.settings.theme.ai.explanation'
                                    defaultMessage='Theme Explanation'
                                />
                            </h4>
                            <CopyButton
                                content={aiTheme.explanation}
                                isForText={true}
                                className='ai-theme-explanation__copy-button'
                            />
                        </div>
                        <div className='ai-theme-explanation__content'>
                            <p className='ai-theme-explanation__text'>
                                {aiTheme.explanation}
                            </p>
                        </div>
                    </div>
                )}

                {/* Theme Preference Selection for Regeneration */}
                <div className='ai-theme-preference-selection'>
                    <h5 className='ai-theme-preference-selection__title'>
                        <FormattedMessage
                            id='user.settings.theme.ai.themePreference'
                            defaultMessage='Theme Preference'
                        />
                    </h5>
                    <div className='ai-theme-preference-selection__options'>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    type='radio'
                                    name='themePreference'
                                    value='light'
                                    checked={themePreference === 'light'}
                                    onChange={(e) => setThemePreference(e.target.value as 'light' | 'dark' | 'auto')}
                                />
                                <FormattedMessage
                                    id='user.settings.theme.ai.lightTheme'
                                    defaultMessage='Light Theme'
                                />
                            </label>
                        </div>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    type='radio'
                                    name='themePreference'
                                    value='dark'
                                    checked={themePreference === 'dark'}
                                    onChange={(e) => setThemePreference(e.target.value as 'light' | 'dark' | 'auto')}
                                />
                                <FormattedMessage
                                    id='user.settings.theme.ai.darkTheme'
                                    defaultMessage='Dark Theme'
                                />
                            </label>
                        </div>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    type='radio'
                                    name='themePreference'
                                    value='auto'
                                    checked={themePreference === 'auto'}
                                    onChange={(e) => setThemePreference(e.target.value as 'light' | 'dark' | 'auto')}
                                />
                                <FormattedMessage
                                    id='user.settings.theme.ai.autoTheme'
                                    defaultMessage='Auto (Let AI Decide)'
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Regenerate Button */}
                <div className='ai-theme-actions'>
                    <button
                        className='btn btn-secondary'
                        onClick={handleGenerateTheme}
                        disabled={generating}
                    >
                        <LoadingWrapper
                            loading={generating}
                            text={intl.formatMessage({
                                id: 'user.settings.theme.ai.regenerating',
                                defaultMessage: 'Regenerating...',
                            })}
                        >
                            <FormattedMessage
                                id='user.settings.theme.ai.regenerateButton'
                                defaultMessage='Regenerate Theme'
                            />
                        </LoadingWrapper>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className='ai-theme-chooser'>
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

            {/* Content */}
            {aiTheme ? renderAITheme() : renderEmptyState()}
        </div>
    );
};

export default AIThemeChooser;
