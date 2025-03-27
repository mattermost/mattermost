// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {SAVE_CHANGES_PANEL_ERROR_TIMEOUT} from 'components/channel_settings_modal/channel_settings_info_tab';
import ColorInput from 'components/color_input';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import './channel_settings_configuration_tab.scss';

const CHANNEL_BANNER_MAX_CHARACTER_LIMIT = 1024;
const CHANNEL_BANNER_MIN_CHARACTER_LIMIT = 0;

const DEFAULT_CHANNEL_BANNER = {
    enabled: false,
    background_color: '',
    text: '',
};

type Props = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    IsTabSwitchActionWithUnsaved?: boolean;
}

function ChannelSettingsConfigurationTab({channel, setAreThereUnsavedChanges, IsTabSwitchActionWithUnsaved}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // TODO: use actual placeholder
    const heading = formatMessage({id: 'channel_banner.label.name', defaultMessage: 'Channel Banner'});
    const subHeading = formatMessage({id: 'channel_banner.label.subtext', defaultMessage: 'When enabled, a customized banner will display at the top of the channel.'});
    const bannerTextSettingTitle = formatMessage({id: 'channel_banner.banner_text.label', defaultMessage: 'Banner text'});
    const bannerColorSettingTitle = formatMessage({id: 'channel_banner.banner_color.label', defaultMessage: 'Banner color'});
    const bannerTextPlaceholder = formatMessage({id: 'channel_banner.banner_text.placeholder', defaultMessage: 'Banner text placeholder'});

    // TODO: populate initial state with actual channel info
    const initialBannerInfo = channel.banner_info || DEFAULT_CHANNEL_BANNER;

    const [formError, setFormError] = useState('');
    const [showBannerTextPreview, setShowBannerTextPreview] = useState(false);
    const [updatedChannelBanner, setUpdatedChannelBanner] = useState(initialBannerInfo);

    // SaveChangesPanel state
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [characterLimitExceeded, setCharacterLimitExceeded] = useState(false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [switchingTabsWithUnsaved, setSwitchingTabsWithUnsaved] = useState(IsTabSwitchActionWithUnsaved);

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

    const handleTextChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setUpdatedChannelBanner({
            ...updatedChannelBanner,
            text: e.target.value,
        });

        if (e.target.value.trim().length > CHANNEL_BANNER_MAX_CHARACTER_LIMIT) {
            setFormError(formatMessage({
                id: 'channel_settings.save_changes_panel.standard_error',
                defaultMessage: 'There are errors in the form above',
            }));
            setCharacterLimitExceeded(true);
        } else if (e.target.value.trim().length <= CHANNEL_BANNER_MIN_CHARACTER_LIMIT) {
            setFormError(formatMessage({
                id: 'channel_settings.save_changes_panel.banner_text.required_error',
                defaultMessage: 'TODO channel banner text is required',
            }));
            setCharacterLimitExceeded(true);
        } else {
            setFormError('');
            setCharacterLimitExceeded(false);
        }
    }, [formatMessage, updatedChannelBanner]);

    const handleColorChange = useCallback((color: string) => {
        setUpdatedChannelBanner((banner) => {
            banner.background_color = color;
        });
    }, []);

    const toggleTextPreview = useCallback(() => setShowBannerTextPreview((show) => !show), []);

    const hasUnsavedChanges = useCallback(() => {
        return updatedChannelBanner.text !== initialBannerInfo?.text ||
            updatedChannelBanner.background_color !== initialBannerInfo?.background_color ||
            updatedChannelBanner.enabled !== initialBannerInfo?.enabled;
    }, [initialBannerInfo, updatedChannelBanner]);

    useEffect(() => {
        const unsavedChanges = hasUnsavedChanges();
        setRequireConfirm(unsavedChanges);
        setAreThereUnsavedChanges?.(unsavedChanges);
        setSwitchingTabsWithUnsaved(IsTabSwitchActionWithUnsaved);

        if (IsTabSwitchActionWithUnsaved) {
            setTimeout(() => {
                setSwitchingTabsWithUnsaved(false);
            }, SAVE_CHANGES_PANEL_ERROR_TIMEOUT);
        }
    }, [IsTabSwitchActionWithUnsaved, hasUnsavedChanges, setAreThereUnsavedChanges]);

    const bannerTextboxRef = useRef<TextboxClass>(null);

    const handleServerError = (err: ServerError) => {
        const errorMsg = err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'});
        setFormError(errorMsg);
    };

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!channel) {
            return false;
        }

        if (updatedChannelBanner.enabled && !updatedChannelBanner.text.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_text_required',
                defaultMessage: 'Banner text is required',
            }));
            return false;
        }

        if (updatedChannelBanner.enabled && !updatedChannelBanner.background_color.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_color_required',
                defaultMessage: 'Banner color is required',
            }));
            return false;
        }

        // Build updated channel object
        const updated: Channel = {
            ...channel,
        };

        // todo: this will be fixed when other channel banner PR is merged
        updated.banner_info = {
            text: updatedChannelBanner.text,
            background_color: updatedChannelBanner.background_color,
            enabled: updatedChannelBanner.enabled,
        };

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return false;
        }

        return true;
    }, [channel, dispatch, formatMessage, handleServerError, updatedChannelBanner]);

    const handleSaveChanges = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
    }, [handleSave]);

    const handleCancel = useCallback(() => {
        setRequireConfirm(false);
        setSaveChangesPanelState(undefined);
        setShowBannerTextPreview(false);

        setUpdatedChannelBanner(initialBannerInfo);
        setFormError('');
        setCharacterLimitExceeded(false);
    }, [initialBannerInfo]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const hasErrors = Boolean(formError) ||
        characterLimitExceeded ||
        Boolean(switchingTabsWithUnsaved);

    return (
        <div className='ChannelSettingsModal__configurationTab'>
            <div className='channel_banner_header'>
                <div className='channel_banner_header__text'>
                    <span
                        className='heading'
                        aria-label={heading}
                    >
                        {heading}
                    </span>
                    <span
                        className='subheading'
                        aria-label={subHeading}
                    >
                        {subHeading}
                    </span>
                </div>

                <div className='channel_banner_header__toggle'>
                    <Toggle
                        id='channelBannerToggle'
                        ariaLabel={heading}
                        size='btn-md'
                        disabled={false}
                        onToggle={handleToggle}
                        toggled={updatedChannelBanner.enabled}
                        tabIndex={-1}
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
                                value={updatedChannelBanner.text}
                                channelId={channel.id}
                                onChange={handleTextChange}
                                createMessage={bannerTextPlaceholder}
                                preview={showBannerTextPreview}
                                togglePreview={toggleTextPreview}
                                textboxRef={bannerTextboxRef}
                                useChannelMentions={false}
                                onKeypress={() => {}}
                                hasError={characterLimitExceeded}
                                showCharacterCount={true}
                                minCharacterLimit={CHANNEL_BANNER_MIN_CHARACTER_LIMIT}
                                characterLimit={CHANNEL_BANNER_MAX_CHARACTER_LIMIT}
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
                                value={updatedChannelBanner.background_color}
                            />
                        </div>
                    </div>
                </div>
            }

            {requireConfirm && (
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
