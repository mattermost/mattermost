// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {getChannelAutotranslation} from 'mattermost-redux/selectors/entities/channels';

import ColorInput from 'components/color_input';
import type {TextboxElement} from 'components/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import './channel_settings_configuration_tab.scss';
import type {GlobalState} from 'types/store';

const CHANNEL_BANNER_MAX_CHARACTER_LIMIT = 1024;
const CHANNEL_BANNER_MIN_CHARACTER_LIMIT = 0;

const DEFAULT_CHANNEL_BANNER = {
    enabled: false,
    background_color: '#DDDDDD',
    text: '',
};

type Props = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
    canManageChannelTranslation?: boolean;
    canManageBanner?: boolean;
}

function bannerHasChanges(originalBannerInfo: Channel['banner_info'], updatedBannerInfo: Channel['banner_info']): boolean {
    return (originalBannerInfo?.text?.trim() || '') !== (updatedBannerInfo?.text?.trim() || '') ||
        (originalBannerInfo?.background_color?.trim() || '') !== (updatedBannerInfo?.background_color?.trim() || '') ||
        originalBannerInfo?.enabled !== updatedBannerInfo?.enabled;
}

function ChannelSettingsConfigurationTab({
    channel,
    setAreThereUnsavedChanges,
    showTabSwitchError,
    canManageChannelTranslation,
    canManageBanner,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const heading = formatMessage({id: 'channel_banner.label.name', defaultMessage: 'Channel Banner'});
    const subHeading = formatMessage({id: 'channel_banner.label.subtext', defaultMessage: 'When enabled, a customized banner will display at the top of the channel.'});
    const bannerTextSettingTitle = formatMessage({id: 'channel_banner.banner_text.label', defaultMessage: 'Banner text'});
    const bannerColorSettingTitle = formatMessage({id: 'channel_banner.banner_color.label', defaultMessage: 'Banner color'});
    const bannerTextPlaceholder = formatMessage({id: 'channel_banner.banner_text.placeholder', defaultMessage: 'Channel banner text'});

    const autoTranslationHeading = formatMessage({id: 'channel_translation.label.name', defaultMessage: 'Auto-translation'});
    const autoTranslationSubHeading = formatMessage({id: 'channel_translation.label.subtext', defaultMessage: 'When enabled, messages in this channel will be translated to members\' own languages. Members can opt-out of this from the channel menu to view the original message instead.'});

    const initialBannerInfo = channel.banner_info || DEFAULT_CHANNEL_BANNER;

    const initialIsChannelAutotranslated = useSelector((state: GlobalState) => getChannelAutotranslation(state, channel.id));
    const [isChannelAutotranslated, setIsChannelAutotranslated] = useState(initialIsChannelAutotranslated);

    const [formError, setFormError] = useState('');
    const [showBannerTextPreview, setShowBannerTextPreview] = useState(false);
    const [updatedChannelBanner, setUpdatedChannelBanner] = useState(initialBannerInfo);

    const [requireConfirm, setRequireConfirm] = useState(false);
    const [characterLimitExceeded, setCharacterLimitExceeded] = useState(false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    // Change handlers
    const handleToggle = useCallback(() => {
        const newValue = !updatedChannelBanner.enabled;
        const toUpdate = {
            ...updatedChannelBanner,
            enabled: newValue,
        };
        if (!newValue) {
            toUpdate.text = initialBannerInfo.text;
            toUpdate.background_color = initialBannerInfo.background_color;
        }

        setUpdatedChannelBanner(toUpdate);
    }, [initialBannerInfo, updatedChannelBanner]);

    const resetFormErrors = useCallback(() => {
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, []);

    const handleTextChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;
        setUpdatedChannelBanner((prev) => ({
            ...prev,
            text: newValue,
        }));

        if (newValue.trim().length > CHANNEL_BANNER_MAX_CHARACTER_LIMIT) {
            setFormError(formatMessage({
                id: 'channel_settings.save_changes_panel.standard_error',
                defaultMessage: 'There are errors in the form above',
            }));
            setCharacterLimitExceeded(true);
        } else if (newValue.trim().length <= CHANNEL_BANNER_MIN_CHARACTER_LIMIT) {
            setFormError(formatMessage({
                id: 'channel_settings.save_changes_panel.banner_text.required_error',
                defaultMessage: 'Channel banner text cannot be empty when enabled',
            }));
            setCharacterLimitExceeded(true);
        } else {
            resetFormErrors();
            setCharacterLimitExceeded(false);
        }
    }, [formatMessage, resetFormErrors]);

    const handleColorChange = useCallback((color: string) => {
        setUpdatedChannelBanner((prev) => ({
            ...prev,
            background_color: color,
        }));

        if (color.trim()) {
            resetFormErrors();
        }
    }, [resetFormErrors]);

    const toggleTextPreview = useCallback(() => setShowBannerTextPreview((show) => !show), []);

    const handleAutoTranslationToggle = useCallback(async () => {
        setIsChannelAutotranslated((prev) => !prev);
    }, []);

    const hasUnsavedChanges = bannerHasChanges(initialBannerInfo, updatedChannelBanner) ||
        isChannelAutotranslated !== initialIsChannelAutotranslated;

    useEffect(() => {
        setRequireConfirm(hasUnsavedChanges);
        setAreThereUnsavedChanges?.(hasUnsavedChanges);
    }, [hasUnsavedChanges, setAreThereUnsavedChanges]);

    const handleServerError = useCallback((err: ServerError) => {
        const errorMsg = err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'});
        setFormError(errorMsg);
    }, [formatMessage]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!channel) {
            return false;
        }

        if (updatedChannelBanner.enabled && !updatedChannelBanner.text?.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_text_required',
                defaultMessage: 'Banner text is required',
            }));
            return false;
        }

        if (updatedChannelBanner.enabled && !updatedChannelBanner.background_color?.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_color_required',
                defaultMessage: 'Banner color is required',
            }));
            return false;
        }

        const updated: Partial<Channel> = {};

        if (bannerHasChanges(initialBannerInfo, updatedChannelBanner)) {
            updated.banner_info = {
                text: updatedChannelBanner.text?.trim() || '',
                background_color: updatedChannelBanner.background_color?.trim() || '',
                enabled: updatedChannelBanner.enabled,
            };
        }

        if (isChannelAutotranslated !== initialIsChannelAutotranslated) {
            updated.autotranslation = isChannelAutotranslated;
        }

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return false;
        }

        return true;
    }, [channel, dispatch, formatMessage, handleServerError, initialBannerInfo, initialIsChannelAutotranslated, isChannelAutotranslated, updatedChannelBanner]);

    const handleSaveChanges = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }

        // Update local state with trimmed values after successful save
        setUpdatedChannelBanner((prev) => ({
            ...prev,
            text: prev.text?.trim() || '',
            background_color: prev.background_color?.trim() || '',
        }));

        resetFormErrors();
        setSaveChangesPanelState('saved');
    }, [handleSave, resetFormErrors]);

    const handleCancel = useCallback(() => {
        setRequireConfirm(false);
        setSaveChangesPanelState(undefined);
        setShowBannerTextPreview(false);

        setUpdatedChannelBanner(initialBannerInfo);
        setFormError('');
        setSaveChangesPanelState(undefined);
        setCharacterLimitExceeded(false);
    }, [initialBannerInfo]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const hasErrors = Boolean(formError) ||
        characterLimitExceeded ||
        showTabSwitchError;

    const showSaveChangesPanel = requireConfirm || saveChangesPanelState === 'saved';

    return (
        <div className='ChannelSettingsModal__configurationTab'>
            {canManageBanner && (
                <>
                    <div className='channel_banner_header'>
                        <div className='channel_banner_header__text'>
                            <label
                                className='Input_legend'
                                aria-label={heading}
                            >
                                {heading}
                            </label>
                            <label
                                className='Input_subheading'
                                aria-label={heading}
                            >
                                {subHeading}
                            </label>
                        </div>

                        <div className='channel_banner_header__toggle'>
                            <Toggle
                                id='channelBannerToggle'
                                ariaLabel={heading}
                                size='btn-md'
                                disabled={false}
                                onToggle={handleToggle}
                                toggled={updatedChannelBanner.enabled}
                                tabIndex={0}
                                toggleClassName='btn-toggle-primary'
                            />
                        </div>
                    </div>

                    {
                        updatedChannelBanner.enabled &&
                        <div className='channel_banner_section_body'>
                            {/*Banner text section*/}
                            <div className='setting_section'>
                                <span
                                    className='setting_title'
                                    aria-label={bannerTextSettingTitle}
                                >
                                    {bannerTextSettingTitle}
                                </span>

                                <div className='setting_body'>
                                    <AdvancedTextbox
                                        id='channel_banner_banner_text_textbox'
                                        value={updatedChannelBanner.text!}
                                        channelId={channel.id}
                                        onKeyPress={() => {}}
                                        showCharacterCount={true}
                                        useChannelMentions={false}
                                        onChange={handleTextChange}
                                        preview={showBannerTextPreview}
                                        togglePreview={toggleTextPreview}
                                        hasError={characterLimitExceeded}
                                        createMessage={bannerTextPlaceholder}
                                        maxLength={CHANNEL_BANNER_MAX_CHARACTER_LIMIT}
                                        minLength={CHANNEL_BANNER_MIN_CHARACTER_LIMIT}
                                    />
                                </div>
                            </div>

                            {/*Banner background color section*/}
                            <div className='setting_section'>
                                <span
                                    className='setting_title'
                                    aria-label={bannerColorSettingTitle}
                                >
                                    {bannerColorSettingTitle}
                                </span>

                                <div className='setting_body'>
                                    <ColorInput
                                        id='channel_banner_banner_background_color_picker'
                                        onChange={handleColorChange}
                                        value={updatedChannelBanner.background_color || ''}
                                    />
                                </div>
                            </div>
                        </div>
                    }
                </>
            )}

            {canManageChannelTranslation && (
                <div className='channel_translation_header'>
                    <div className='channel_translation_header__text'>
                        <label
                            className='Input_legend'
                            aria-label={autoTranslationHeading}
                        >
                            {autoTranslationHeading}
                        </label>
                        <label
                            className='Input_subheading'
                            aria-label={autoTranslationSubHeading}
                        >
                            {autoTranslationSubHeading}
                        </label>
                    </div>

                    <div className='channel_translation_header__toggle'>
                        <Toggle
                            id='channelTranslationToggle'
                            ariaLabel={autoTranslationHeading}
                            size='btn-md'
                            disabled={false}
                            onToggle={handleAutoTranslationToggle}
                            toggled={isChannelAutotranslated}
                            tabIndex={0}
                            toggleClassName='btn-toggle-primary'
                        />
                    </div>
                </div>
            )}

            {showSaveChangesPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? 'error' : saveChangesPanelState}
                    customErrorMessage={formError}
                    cancelButtonText={formatMessage({
                        id: 'channel_settings.save_changes_panel.reset',
                        defaultMessage: 'Reset',
                    })}
                />
            )}
        </div>
    );
}

export default ChannelSettingsConfigurationTab;
