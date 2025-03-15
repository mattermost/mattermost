// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
} from 'actions/views/textbox';
import {
    showPreviewOnChannelSettingsHeaderModal,
    showPreviewOnChannelSettingsPurposeModal,
} from 'selectors/views/textbox';

import ShowFormat from 'components/advanced_text_editor/show_formatting/show_formatting';
import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import Constants from 'utils/constants';

type ChannelSettingsInfoTabProps = {
    channel: Channel;
    displayName: string;
    setDisplayName: (name: string) => void;
    url: string;
    setURL: (url: string) => void;
    channelType: ChannelType;
    setChannelType: (type: ChannelType) => void;
    channelHeader: string;
    setChannelHeader: (header: string) => void;
    channelPurpose: string;
    setChannelPurpose: (purpose: string) => void;
    urlError: string;
    setURLError: (error: string) => void;
    serverError: string;
    setServerError: (error: string) => void;
    canConvertToPublic: boolean;
    canConvertToPrivate: boolean;
    headerTextboxRef: React.RefObject<TextboxClass>;
    purposeTextboxRef: React.RefObject<TextboxClass>;
    requireConfirm: boolean;
    saveChangesPanelState?: SaveChangesPanelState;
    handleSaveChanges: () => Promise<void>;
    handleCancel: () => void;
    handleClose: () => void;
    characterLimitExceeded: boolean;
};

function ChannelSettingsInfoTab({
    channel,
    displayName,
    setDisplayName,
    url,
    setURL,
    channelType,
    setChannelType,
    channelHeader,
    setChannelHeader,
    channelPurpose,
    setChannelPurpose,
    urlError,
    setURLError,
    serverError,
    setServerError,
    canConvertToPublic,
    canConvertToPrivate,
    headerTextboxRef,
    purposeTextboxRef,
    requireConfirm,
    saveChangesPanelState,
    handleSaveChanges,
    handleCancel,
    handleClose,
    characterLimitExceeded,
}: ChannelSettingsInfoTabProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const shouldShowPreviewPurpose = useSelector(showPreviewOnChannelSettingsPurposeModal);
    const shouldShowPreviewHeader = useSelector(showPreviewOnChannelSettingsHeaderModal);

    // Constants
    const headerMaxLength = 1024;

    const handleURLChange = useCallback((newURL: string) => {
        setURL(newURL);
        setURLError('');
    }, [setURL, setURLError]);

    const togglePurposePreview = useCallback(() => {
        dispatch(setShowPreviewOnChannelSettingsPurposeModal(!shouldShowPreviewPurpose));
    }, [dispatch, shouldShowPreviewPurpose]);

    const toggleHeaderPreview = useCallback(() => {
        dispatch(setShowPreviewOnChannelSettingsHeaderModal(!shouldShowPreviewHeader));
    }, [dispatch, shouldShowPreviewHeader]);

    const handleChannelTypeChange = (type: ChannelType) => {
        // If canCreatePublic is false, do not allow. Similarly if canCreatePrivate is false, do not allow
        if (type === Constants.OPEN_CHANNEL && !canConvertToPublic) {
            return;
        }
        if (type === Constants.PRIVATE_CHANNEL && !canConvertToPrivate) {
            return;
        }
        setChannelType(type);
        setServerError('');
    };

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;

        // Update the header value
        setChannelHeader(newValue);

        // Check for character limit
        if (newValue.length > headerMaxLength) {
            setServerError(formatMessage({
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            }, {
                maxLength: headerMaxLength,
            }));
        } else if (serverError) {
            setServerError('');
        }
    }, [setChannelHeader, headerMaxLength, serverError, setServerError, formatMessage]);

    return (
        <div className='ChannelSettingsModal__infoTab'>
            {/* Channel Name Section*/}
            <label className='Input_legend'>{formatMessage({id: 'channel_settings.label.name', defaultMessage: 'Channel Name'})}</label>
            <ChannelNameFormField
                value={displayName}
                name='channel-settings-name'
                placeholder={formatMessage({
                    id: 'channel_settings_modal.name.placeholder',
                    defaultMessage: 'Enter a name for your channel',
                })}
                onDisplayNameChange={(name) => {
                    setDisplayName(name);
                }}
                onURLChange={handleURLChange}
                urlError={urlError}
                currentUrl={url}
            />

            {/* Channel Type Section*/}
            <PublicPrivateSelector
                className='ChannelSettingsModal__typeSelector'
                selected={channelType}
                publicButtonProps={{
                    title: formatMessage({id: 'channel_modal.type.public.title', defaultMessage: 'Public Channel'}),
                    description: formatMessage({id: 'channel_modal.type.public.description', defaultMessage: 'Anyone can join'}),
                    disabled: !canConvertToPublic,
                }}
                privateButtonProps={{
                    title: formatMessage({id: 'channel_modal.type.private.title', defaultMessage: 'Private Channel'}),
                    description: formatMessage({id: 'channel_modal.type.private.description', defaultMessage: 'Only invited members'}),
                    disabled: !canConvertToPrivate,
                }}
                onChange={handleChannelTypeChange}
            />

            {/* Purpose Section*/}
            <div className='textarea-wrapper'>
                <Textbox
                    value={channelPurpose}
                    onChange={(e: React.ChangeEvent<TextboxElement>) => {
                        setChannelPurpose(e.target.value);

                        // Check for character limit
                        if (e.target.value.length > Constants.MAX_CHANNELPURPOSE_LENGTH) {
                            setServerError(formatMessage({
                                id: 'channel_settings.error_purpose_length',
                                defaultMessage: 'The text entered exceeds the character limit. The channel purpose is limited to {maxLength} characters.',
                            }, {
                                maxLength: Constants.MAX_CHANNELPURPOSE_LENGTH,
                            }));
                        } else if (serverError) {
                            setServerError('');
                        }
                    }}
                    onKeyPress={() => {
                        // No specific key press handling needed for the settings modal
                    }}
                    supportsCommands={false}
                    suggestionListPosition='bottom'
                    createMessage={formatMessage({
                        id: 'channel_settings_modal.purpose.placeholder',
                        defaultMessage: 'Enter a purpose for this channel',
                    })}
                    ref={purposeTextboxRef}
                    channelId={channel.id}
                    id='channel_settings_purpose_textbox'
                    characterLimit={Constants.MAX_CHANNELPURPOSE_LENGTH}
                    preview={shouldShowPreviewPurpose}
                    useChannelMentions={false}
                />
                <ShowFormat
                    onClick={togglePurposePreview}
                    active={shouldShowPreviewPurpose}
                />
                <p
                    data-testid='mm-modal-generic-section-item__description'
                    className='mm-modal-generic-section-item__description'
                >
                    <FormattedMessage
                        id='channel_settings.purpose.description'
                        defaultMessage='Describe how this channel should be used.'
                    />
                </p>
            </div>

            {/* Channel Header Section*/}
            <div className='textarea-wrapper'>
                <Textbox
                    value={channelHeader}
                    onChange={handleChange}
                    onKeyPress={() => {
                        // No specific key press handling needed for the settings modal
                    }}
                    supportsCommands={false}
                    suggestionListPosition='bottom'
                    createMessage={formatMessage({
                        id: 'channel_settings_modal.header.placeholder',
                        defaultMessage: 'Enter a header description or important links',
                    })}
                    channelId={channel.id}
                    id='channel_settings_header_textbox'
                    ref={headerTextboxRef}
                    characterLimit={headerMaxLength}
                    preview={shouldShowPreviewHeader}
                    useChannelMentions={false}
                />
                <p
                    data-testid='mm-modal-generic-section-item__description'
                    className='mm-modal-generic-section-item__description'
                >
                    <FormattedMessage
                        id='channel_settings.purpose.header'
                        defaultMessage='This is the text that will appear in the header of the channel beside the channel name. You can use markdown to include links by typing [Link Title](http://example.com).'
                    />
                </p>
                <ShowFormat
                    onClick={toggleHeaderPreview}
                    active={shouldShowPreviewHeader}
                />
            </div>

            {/* SaveChangesPanel for unsaved changes */}
            {requireConfirm && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={characterLimitExceeded}
                    state={characterLimitExceeded ? 'error' : saveChangesPanelState}
                    customErrorMessage={serverError}
                />
            )}
        </div>
    );
}

export default ChannelSettingsInfoTab;
