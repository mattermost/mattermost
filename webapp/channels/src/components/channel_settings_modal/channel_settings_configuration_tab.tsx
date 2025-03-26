// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';

import {useIntl} from 'react-intl';

import './channel_settings_configuration_tab.scss';

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

const CHANNEL_BANNER_CHARACTER_LIMIT = 1024;

// TODO: delete these when using actual channel banner values
const initialChannelBannerEnabled = true;
const initialBannerText = '**Controlled Unclassified:** Impact Level 5. ';
const initialBannerBackgroundColor = '#517391';

type Props = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    IsTabSwitchActionWithUnsaved?: boolean;
}

function ChannelSettingsConfigurationTab({channel, setAreThereUnsavedChanges, IsTabSwitchActionWithUnsaved}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // TODO: populate initial state witha ctual channel info
    const [channelBannerEnabled, setChannelBannerEnabled] = useState(initialChannelBannerEnabled);
    const [channelBannerColor, setChannelBannerColor] = useState(initialBannerBackgroundColor);
    const [channelBannerText, setChannelBannerText] = useState(initialBannerText);

    const [formError, setFormError] = useState('');

    const [showBannerTextPreview, setShowBannerTextPreview] = useState(false);

    // SaveChangesPanel state
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [switchingTabsWithUnsaved, setSwitchingTabsWithUnsaved] = useState(IsTabSwitchActionWithUnsaved);
    const [characterLimitExceeded, setCharacterLimitExceeded] = useState(false);

    const handleChannelBannerTextChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        console.log({val: e.target.value});

        setChannelBannerText(e.target.value);
        setCharacterLimitExceeded(e.target.value.length > CHANNEL_BANNER_CHARACTER_LIMIT);
    }, []);

    const toggleBannerTextPreview = useCallback(() => setShowBannerTextPreview((show) => !show), []);

    const hasUnsavedChanges = useCallback(() => {
        return channelBannerText !== initialBannerText || channelBannerColor !== initialBannerBackgroundColor || channelBannerEnabled !== initialChannelBannerEnabled;
    }, [channelBannerColor, channelBannerEnabled, channelBannerText]);

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

    const heading = formatMessage({id: 'channel_banner.label.name', defaultMessage: 'Channel Banner'});
    const subHeading = formatMessage({id: 'channel_banner.label.subtext', defaultMessage: 'When enabled, a customized banner will display at the top of the channel.'});

    const bannerTextSettingTitle = formatMessage({id: 'channel_banner.banner_text.label', defaultMessage: 'Banner text'});
    const bannerColorSettingTitle = formatMessage({id: 'channel_banner.banner_color.label', defaultMessage: 'Banner color'});

    // TODO: Replace with actual placeholder
    const bannerTextPlaceholder = formatMessage({id: 'channel_banner.banner_text.placeholder', defaultMessage: 'Banner text placeholder'});

    const bannerTextboxRef = useRef<TextboxClass>(null);

    const handleServerError = (err: ServerError) => {
        const errorMsg = err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'});
        setFormError(errorMsg);
    };

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!channel) {
            return false;
        }

        console.log({channelBannerText});

        if (channelBannerEnabled && !channelBannerText.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_text_required',
                defaultMessage: 'Banner text is required',
            }));
            return false;
        }

        if (channelBannerEnabled && !channelBannerColor.trim()) {
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

        updated.banner_info = {
            text: channelBannerText,
            background_color: channelBannerColor,
            enabled: channelBannerEnabled,
        };

        console.log({updated});

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return false;
        }

        return true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelBannerEnabled, channelBannerText, channelBannerColor]);

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

        setChannelBannerText(initialBannerText);
        setChannelBannerEnabled(initialChannelBannerEnabled);
        setChannelBannerColor(initialBannerBackgroundColor);

        setFormError('');
    }, []);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const hasErrors = Boolean(formError) ||
        characterLimitExceeded ||
        Boolean(formError) ||
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
                        onToggle={() => setChannelBannerEnabled((x) => !x)}
                        toggled={channelBannerEnabled}
                        tabIndex={-1}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>

            {
                channelBannerEnabled &&
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
                                value={channelBannerText}
                                channelId={channel.id}
                                onChange={handleChannelBannerTextChange}
                                createMessage={bannerTextPlaceholder}
                                characterLimit={CHANNEL_BANNER_CHARACTER_LIMIT}
                                preview={showBannerTextPreview}
                                togglePreview={toggleBannerTextPreview}
                                textboxRef={bannerTextboxRef}
                                useChannelMentions={false}
                                onKeypress={() => {}}
                                hasError={false}
                                showCharacterCount={false}
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
                                onChange={setChannelBannerColor}
                                value={channelBannerColor}
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
                    customErrorMessage={formatMessage({
                        id: 'channel_settings.save_changes_panel.standard_error',
                        defaultMessage: 'There are errors in the form above',
                    })}
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
