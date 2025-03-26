// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';
import {getChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {isChannelAdmin} from 'mattermost-redux/utils/user_utils';

import {
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
} from 'actions/views/textbox';
import {
    showPreviewOnChannelSettingsHeaderModal,
    showPreviewOnChannelSettingsPurposeModal,
} from 'selectors/views/textbox';

import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

type ChannelSettingsInfoTabProps = {
    channel: Channel;
    onCancel?: () => void;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    IsTabSwitchActionWithUnsaved?: boolean;
};

const SAVE_CHANGES_PANEL_ERROR_TIMEOUT = 3000;

function ChannelSettingsInfoTab({
    channel,
    onCancel,
    setAreThereUnsavedChanges,
    IsTabSwitchActionWithUnsaved,
}: ChannelSettingsInfoTabProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const shouldShowPreviewPurpose = useSelector(showPreviewOnChannelSettingsPurposeModal);
    const shouldShowPreviewHeader = useSelector(showPreviewOnChannelSettingsHeaderModal);
    const user = useSelector(getCurrentUser);

    // Permissions for transforming channel type
    const canConvertToPrivate = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE),
    );
    const canConvertToPublic = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CONVERT_PRIVATE_CHANNEL_TO_PUBLIC),
    );

    // verify if current user is the channel admin (if is, should have permission to manage channel properties and type)
    const channelMember = useSelector((state: GlobalState) => getChannelMember(state, channel.id, user.id));
    const isCurrentUserAChannelAdmin = isChannelAdmin(channelMember!.roles);

    // Permissions for managing channel (name, header, purpose)
    const channelPropertiesPermission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
    const canManageChannelProperties = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, channelPropertiesPermission),
    );

    // Constants
    const HEADER_MAX_LENGTH = 1024;

    // Internal state variables
    const [internalUrlError, setUrlError] = useState('');
    const [channelNameError, setChannelNameError] = useState('');
    const [characterLimitExceeded, setCharacterLimitExceeded] = useState(false);

    const [switchingTabsWithUnsaved, setSwitchingTabsWithUnsaved] = useState(IsTabSwitchActionWithUnsaved);

    // Refs
    const headerTextboxRef = useRef<TextboxClass>(null);
    const purposeTextboxRef = useRef<TextboxClass>(null);

    // The fields we allow editing
    const [displayName, setDisplayName] = useState(channel?.display_name ?? '');
    const [channelUrl, setChannelURL] = useState(channel?.name ?? '');
    const [channelPurpose, setChannelPurpose] = useState(channel.purpose ?? '');
    const [channelHeader, setChannelHeader] = useState(channel?.header ?? '');
    const [channelType, setChannelType] = useState<ChannelType>(channel?.type as ChannelType ?? Constants.OPEN_CHANNEL as ChannelType);

    // UI Feedback: errors, states
    const [formError, setFormError] = useState('');

    // SaveChangesPanel state
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    // Handler for channel name validation errors
    const handleChannelNameError = useCallback((isError: boolean, errorMessage?: string) => {
        setChannelNameError(errorMessage || '');

        // If there's an error, update the error to show in the SaveChangesPanel
        if (isError && errorMessage) {
            setFormError(errorMessage);
        } else if (formError === channelNameError) {
            // Only clear error if it's the same as the channel name error
            setFormError('');
        }
    }, [channelNameError, formError, setFormError]);

    // For checking unsaved changes, we compare the current form values with the original channel values
    const hasUnsavedChanges = useCallback(() => {
        if (!channel) {
            return false;
        }

        return (
            displayName !== channel.display_name ||
            channelUrl !== channel.name ||
            channelPurpose !== channel.purpose ||
            channelHeader !== channel.header ||
            channelType !== channel.type
        );
    }, [channel, displayName, channelUrl, channelPurpose, channelHeader, channelType]);

    // Set requireConfirm whenever an edit has occurred
    useEffect(() => {
        const unsavedChanges = hasUnsavedChanges();
        setRequireConfirm(unsavedChanges);
        setAreThereUnsavedChanges?.(unsavedChanges);
        setSwitchingTabsWithUnsaved(IsTabSwitchActionWithUnsaved);

        // If switching tabs with unsaved changes, show the error state in the save changes panel for a few seconds
        if (IsTabSwitchActionWithUnsaved) {
            setTimeout(() => {
                setSwitchingTabsWithUnsaved(false);
            }, SAVE_CHANGES_PANEL_ERROR_TIMEOUT);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayName, channelUrl, channelPurpose, channelHeader, channelType, IsTabSwitchActionWithUnsaved]);

    // Update the form fields when the channel prop changes
    useEffect(() => {
        setDisplayName(displayName);
        setChannelURL(channelUrl);
        setChannelPurpose(channelPurpose);
        setChannelHeader(channelHeader);
        setChannelType(channelType);
        setUrlError(internalUrlError);
    }, [displayName, channelUrl, channelPurpose, channelHeader, channelType, internalUrlError]);

    const handleURLChange = useCallback((newURL: string) => {
        if (internalUrlError) {
            setFormError('');
            setSaveChangesPanelState(undefined);
            setUrlError('');
        }
        setChannelURL(newURL);
    }, [internalUrlError]);

    const togglePurposePreview = useCallback(() => {
        dispatch(setShowPreviewOnChannelSettingsPurposeModal(!shouldShowPreviewPurpose));
    }, [dispatch, shouldShowPreviewPurpose]);

    const toggleHeaderPreview = useCallback(() => {
        dispatch(setShowPreviewOnChannelSettingsHeaderModal(!shouldShowPreviewHeader));
    }, [dispatch, shouldShowPreviewHeader]);

    const handleChannelTypeChange = (type: ChannelType) => {
        // If canCreatePublic is false, do not allow. Similarly if canCreatePrivate is false, do not allow
        if (!isCurrentUserAChannelAdmin && (type === Constants.PRIVATE_CHANNEL && !canConvertToPublic)) {
            return;
        }
        if (!isCurrentUserAChannelAdmin && (type === Constants.OPEN_CHANNEL && !canConvertToPrivate)) {
            return;
        }
        setChannelType(type);
        setFormError('');
    };

    const handleHeaderChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;

        // Update the header value
        setChannelHeader(newValue);

        // Check for character limit
        if (newValue.length > HEADER_MAX_LENGTH) {
            setFormError(formatMessage({
                id: 'edit_channel_header_modal.error',
                defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
            }, {
                maxLength: HEADER_MAX_LENGTH,
            }));
        } else if (formError && !channelNameError) {
            // Only clear form error if there's no channel name error
            // This prevents clearing channel name errors when editing the header
            setFormError('');
        }
    }, [HEADER_MAX_LENGTH, formError, channelNameError, setFormError, formatMessage]);

    const handlePurposeChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;

        // Update the purpose value
        setChannelPurpose(newValue);

        // Check for character limit
        if (newValue.length > Constants.MAX_CHANNELPURPOSE_LENGTH) {
            setFormError(formatMessage({
                id: 'channel_settings.error_purpose_length',
                defaultMessage: 'The text entered exceeds the character limit. The channel purpose is limited to {maxLength} characters.',
            }, {
                maxLength: Constants.MAX_CHANNELPURPOSE_LENGTH,
            }));
        } else if (formError && !channelNameError) {
            // Only clear server error if there's no channel name error
            // This prevents clearing channel name errors when editing the purpose
            setFormError('');
        }
    }, [formError, channelNameError, setFormError, formatMessage]);

    // Validate & Save - using useCallback to ensure it has the latest state values
    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!channel) {
            return false;
        }

        if (!displayName.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_display_name_required',
                defaultMessage: 'Channel name is required',
            }));
            return false;
        }

        // Build updated channel object
        const updated: Channel = {
            ...channel,
            display_name: displayName.trim(),
            name: channelUrl.trim(),
            purpose: channelPurpose.trim(),
            header: channelHeader.trim(),
            type: channelType as ChannelType,
        };

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return false;
        }

        return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel, displayName, channelUrl, channelPurpose, channelHeader, channelType]);

    const handleServerError = (err: ServerError) => {
        const errorMsg = err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'});
        setFormError(errorMsg);
        setUrlError(errorMsg);
    };

    // Handle save changes panel actions
    const handleSaveChanges = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
    }, [handleSave]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const handleCancel = useCallback(() => {
        // First, hide the panel immediately to prevent further interactions
        setRequireConfirm(false);
        setSaveChangesPanelState(undefined);

        // Then reset all form fields to their original values
        setDisplayName(channel?.display_name ?? '');
        setChannelURL(channel?.name ?? '');
        setChannelPurpose(channel?.purpose ?? '');
        setChannelHeader(channel?.header ?? '');
        setChannelType(channel?.type as ChannelType ?? Constants.OPEN_CHANNEL as ChannelType);

        // Clear errors
        setUrlError('');
        setFormError('');
        setCharacterLimitExceeded(false);
        setChannelNameError('');

        // If parent provided an onCancel callback, call it
        if (onCancel) {
            onCancel();
        }
    }, [channel, onCancel, setFormError]);

    // Calculate if there are errors
    const hasErrors = Boolean(formError) ||
                     characterLimitExceeded ||
                     Boolean(channelNameError) ||
                     Boolean(switchingTabsWithUnsaved) ||
                     Boolean(internalUrlError);

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
                onErrorStateChange={handleChannelNameError}
                urlError={internalUrlError}
                currentUrl={channelUrl}
                readOnly={!canManageChannelProperties}
            />

            {/* Channel Type Section*/}
            <PublicPrivateSelector
                className='ChannelSettingsModal__typeSelector'
                selected={channelType}
                publicButtonProps={{
                    title: formatMessage({id: 'channel_modal.type.public.title', defaultMessage: 'Public Channel'}),
                    description: formatMessage({id: 'channel_modal.type.public.description', defaultMessage: 'Anyone can join'}),
                    disabled: !isCurrentUserAChannelAdmin && !canConvertToPublic,
                }}
                privateButtonProps={{
                    title: formatMessage({id: 'channel_modal.type.private.title', defaultMessage: 'Private Channel'}),
                    description: formatMessage({id: 'channel_modal.type.private.description', defaultMessage: 'Only invited members'}),
                    disabled: !isCurrentUserAChannelAdmin && !canConvertToPrivate,
                }}
                onChange={handleChannelTypeChange}
            />

            {/* Purpose Section*/}
            <AdvancedTextbox
                id='channel_settings_purpose_textbox'
                value={channelPurpose}
                channelId={channel.id}
                onChange={handlePurposeChange}
                createMessage={formatMessage({
                    id: 'channel_settings_modal.purpose.placeholder',
                    defaultMessage: 'Enter a purpose for this channel',
                })}
                characterLimit={Constants.MAX_CHANNELPURPOSE_LENGTH}
                preview={shouldShowPreviewPurpose}
                togglePreview={togglePurposePreview}
                textboxRef={purposeTextboxRef}
                useChannelMentions={false}
                onKeypress={() => {}}
                descriptionMessage={formatMessage({
                    id: 'channel_settings.purpose.description',
                    defaultMessage: 'Describe how this channel should be used.',
                })}
                hasError={channelPurpose.length > Constants.MAX_CHANNELPURPOSE_LENGTH}
                errorMessage={channelPurpose.length > Constants.MAX_CHANNELPURPOSE_LENGTH ? formatMessage({
                    id: 'channel_settings.error_purpose_length',
                    defaultMessage: 'The channel purpose exceeds the maximum character limit of {maxLength} characters.',
                }, {
                    maxLength: Constants.MAX_CHANNELPURPOSE_LENGTH,
                }) : undefined
                }
                showCharacterCount={channelPurpose.length > Constants.MAX_CHANNELPURPOSE_LENGTH}
                readOnly={!canManageChannelProperties}
            />

            {/* Channel Header Section*/}
            <AdvancedTextbox
                id='channel_settings_header_textbox'
                value={channelHeader}
                channelId={channel.id}
                onChange={handleHeaderChange}
                createMessage={formatMessage({
                    id: 'channel_settings_modal.header.placeholder',
                    defaultMessage: 'Enter a header description or important links',
                })}
                characterLimit={HEADER_MAX_LENGTH}
                preview={shouldShowPreviewHeader}
                togglePreview={toggleHeaderPreview}
                textboxRef={headerTextboxRef}
                useChannelMentions={false}
                onKeypress={() => {}}
                descriptionMessage={formatMessage({
                    id: 'channel_settings.purpose.header',
                    defaultMessage: 'This is the text that will appear in the header of the channel beside the channel name. You can use markdown to include links by typing [Link Title](http://example.com).',
                })}
                hasError={channelHeader.length > HEADER_MAX_LENGTH}
                errorMessage={channelHeader.length > HEADER_MAX_LENGTH ? formatMessage({
                    id: 'edit_channel_header_modal.error',
                    defaultMessage: 'The channel header exceeds the maximum character limit of {maxLength} characters.',
                }, {
                    maxLength: HEADER_MAX_LENGTH,
                }) : undefined
                }
                showCharacterCount={channelHeader.length > HEADER_MAX_LENGTH}
                readOnly={!canManageChannelProperties}
            />

            {/* SaveChangesPanel for unsaved changes */}
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

export default ChannelSettingsInfoTab;
