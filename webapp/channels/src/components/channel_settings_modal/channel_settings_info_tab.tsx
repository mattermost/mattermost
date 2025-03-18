// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useEffect} from 'react';
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
    setCharacterLimitExceeded?: (exceeded: boolean) => void;
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
    setCharacterLimitExceeded,
}: ChannelSettingsInfoTabProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const shouldShowPreviewPurpose = useSelector(showPreviewOnChannelSettingsPurposeModal);
    const shouldShowPreviewHeader = useSelector(showPreviewOnChannelSettingsHeaderModal);

    // Constants
    const headerMaxLength = 1024;

    // Internal state variables
    const [internalDisplayName, setInternalDisplayName] = useState(displayName);
    const [internalUrl, setInternalUrl] = useState(url);
    const [internalChannelPurpose, setInternalChannelPurpose] = useState(channelPurpose);
    const [internalChannelHeader, setInternalChannelHeader] = useState(channelHeader);
    const [internalChannelType, setInternalChannelType] = useState(channelType);
    const [internalUrlError, setInternalUrlError] = useState(urlError);
    const [channelNameError, setChannelNameError] = useState('');

    // Handler for channel name validation errors
    const handleChannelNameError = useCallback((isError: boolean, errorMessage?: string) => {
        setChannelNameError(errorMessage || '');

        // If there's an error, update the server error to show in the SaveChangesPanel
        if (isError && errorMessage) {
            setServerError(errorMessage);
        } else if (serverError === channelNameError) {
            // Only clear server error if it's the same as the channel name error
            setServerError('');
        }
    }, [channelNameError, serverError, setServerError]);

    // Add validation functions
    const checkCharacterLimits = useCallback(() => {
        const isPurposeExceeded = internalChannelPurpose.length > Constants.MAX_CHANNELPURPOSE_LENGTH;
        const isHeaderExceeded = internalChannelHeader.length > headerMaxLength;
        const hasNameError = Boolean(channelNameError);

        const hasErrors = isPurposeExceeded || isHeaderExceeded || hasNameError;

        // Update parent's characterLimitExceeded state if the setter is provided
        if (setCharacterLimitExceeded) {
            setCharacterLimitExceeded(hasErrors);
        }

        if (hasNameError) {
            // The error message is already set by handleChannelNameError
            return false;
        }
        if (isPurposeExceeded) {
            setServerError(formatMessage({
                id: 'channel_settings.error_purpose_length',
                defaultMessage: 'The channel purpose exceeds the maximum character limit of {maxLength} characters.',
            }, {
                maxLength: Constants.MAX_CHANNELPURPOSE_LENGTH,
            }));
            return false;
        }

        if (isHeaderExceeded) {
            setServerError(formatMessage({
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            }, {
                maxLength: headerMaxLength,
            }));
            return false;
        }

        return true;
    }, [internalChannelPurpose, internalChannelHeader, channelNameError, headerMaxLength, formatMessage, setServerError, setCharacterLimitExceeded]);

    // Add effect to notify parent of changes
    useEffect(() => {
        // Update parent state
        setDisplayName(internalDisplayName);
        setURL(internalUrl);
        setChannelPurpose(internalChannelPurpose);
        setChannelHeader(internalChannelHeader);
        setChannelType(internalChannelType);
        setURLError(internalUrlError);

        // Check character limits
        checkCharacterLimits();
    }, [internalDisplayName, internalUrl, internalChannelPurpose, internalChannelHeader, internalChannelType, internalUrlError, checkCharacterLimits, setDisplayName, setURL, setChannelPurpose, setChannelHeader, setChannelType, setURLError]);

    // Add effect to reset internal state when parent state changes (for cancel/reset)
    useEffect(() => {
        setInternalDisplayName(displayName);
        setInternalUrl(url);
        setInternalChannelPurpose(channelPurpose);
        setInternalChannelHeader(channelHeader);
        setInternalChannelType(channelType);
        setInternalUrlError(urlError);
    }, [displayName, url, channelPurpose, channelHeader, channelType, urlError]);

    const handleURLChange = useCallback((newURL: string) => {
        setInternalUrl(newURL);
        setInternalUrlError('');
    }, []);

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
        setInternalChannelType(type);
        setServerError('');
    };

    const handleHeaderChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;

        // Update the header value
        setInternalChannelHeader(newValue);

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
    }, [headerMaxLength, serverError, setServerError, formatMessage]);

    const handlePurposeChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;

        // Update the purpose value
        setInternalChannelPurpose(newValue);

        // Check for character limit
        if (newValue.length > Constants.MAX_CHANNELPURPOSE_LENGTH) {
            setServerError(formatMessage({
                id: 'channel_settings.error_purpose_length',
                defaultMessage: 'The text entered exceeds the character limit. The channel purpose is limited to {maxLength} characters.',
            }, {
                maxLength: Constants.MAX_CHANNELPURPOSE_LENGTH,
            }));
        } else if (serverError) {
            setServerError('');
        }
    }, [serverError, setServerError, formatMessage]);

    return (
        <div className='ChannelSettingsModal__infoTab'>
            {/* Channel Name Section*/}
            <label className='Input_legend'>{formatMessage({id: 'channel_settings.label.name', defaultMessage: 'Channel Name'})}</label>
            <ChannelNameFormField
                value={internalDisplayName}
                name='channel-settings-name'
                placeholder={formatMessage({
                    id: 'channel_settings_modal.name.placeholder',
                    defaultMessage: 'Enter a name for your channel',
                })}
                onDisplayNameChange={(name) => {
                    setInternalDisplayName(name);
                }}
                onURLChange={handleURLChange}
                onErrorStateChange={handleChannelNameError}
                urlError={internalUrlError}
                currentUrl={internalUrl}
            />

            {/* Channel Type Section*/}
            <PublicPrivateSelector
                className='ChannelSettingsModal__typeSelector'
                selected={internalChannelType}
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
                    value={internalChannelPurpose}
                    onChange={handlePurposeChange}
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
                    value={internalChannelHeader}
                    onChange={handleHeaderChange}
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
                    customErrorMessage={formatMessage({
                        id: 'channel_settings.save_changes_panel.standard_error',
                        defaultMessage: 'There are errors in the form above'})
                    }
                />
            )}
        </div>
    );
}

export default ChannelSettingsInfoTab;
