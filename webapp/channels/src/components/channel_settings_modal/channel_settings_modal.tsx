// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import ConfirmModal from 'components/confirm_modal';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';
import {isKeyPressed, cmdOrCtrlPressed} from 'utils/keyboard';
import {stopTryNotificationRing} from 'utils/notification_sounds';

import type {GlobalState} from 'types/store';

import ChannelSettingsSidebar from './channel_settings_sidebar';

import './channel_settings_modal.scss';

type ChannelSettingsModalProps = {
    channel: Channel;
    onExited: () => void;
    focusOriginElement?: string;
    isOpen: boolean;
};

enum ChannelSettingsTabs {
    INFO = 'info',
    CONFIGURATION = 'configuration',
    ARCHIVE = 'archive',
}

function ChannelSettingsModal({channel, isOpen, onExited, focusOriginElement}: ChannelSettingsModalProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const canConvertToPrivate = useSelector((state: GlobalState) =>
        haveITeamPermission(state, channel?.team_id ?? '', Permissions.CREATE_PRIVATE_CHANNEL),
    );
    const canConvertToPublic = useSelector((state: GlobalState) =>
        haveITeamPermission(state, channel?.team_id ?? '', Permissions.CREATE_PUBLIC_CHANNEL),
    );

    const [show, setShow] = useState(isOpen);
    const [enforceFocus, setEnforceFocus] = useState(true);

    // Active tab
    const [activeTab, setActiveTab] = useState<ChannelSettingsTabs>(ChannelSettingsTabs.INFO);

    // We track unsaved changes to prompt a confirm modal
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [customConfirmAction, setCustomConfirmAction] = useState<null |((doConfirm: () => void) => void)>(null);

    // The fields we allow editing
    const [displayName, setDisplayName] = useState(channel?.display_name ?? '');
    const [url, setURL] = useState(channel?.name ?? '');
    const [channelPurpose, setChannelPurpose] = useState(channel.purpose ?? '');

    const [header, setChannelHeader] = useState(channel?.header ?? '');
    const [channelType, setChannelType] = useState<ChannelType>(channel?.type as ChannelType ?? Constants.OPEN_CHANNEL as ChannelType);
    const [showPreview, setShowPreview] = useState(false);

    // UI Feedback: errors, states
    const [urlError, setURLError] = useState('');
    const [serverError, setServerError] = useState('');

    // Refs
    const modalBodyRef = useRef<HTMLDivElement>(null);

    // For checking unsaved changes, we store the initial “loaded” values or do a direct comparison
    const hasUnsavedChanges = useCallback(() => {
        // Compare fields to their original values
        if (!channel) {
            return false;
        }
        return (
            displayName !== channel.display_name ||
            url !== channel.name ||
            channelPurpose !== channel.purpose ||
            header !== channel.header ||
            channelType !== channel.type
        );
    }, [channel, displayName, url, channelPurpose, header, channelType]);

    // Possibly set requireConfirm whenever an edit has occurred
    useEffect(() => {
        setRequireConfirm(hasUnsavedChanges());
    }, [displayName, url, channelPurpose, header, channelType, hasUnsavedChanges]);

    // For KeyDown handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (cmdOrCtrlPressed(e) && e.shiftKey && isKeyPressed(e, Constants.KeyCodes.A)) {
                e.preventDefault();
                handleHide();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Called to set the active tab, prompting confirm if there are unsaved changes
    const updateTab = (newTab: string) => {
        if (requireConfirm) {
            showConfirm(() => updateTabConfirm(newTab));
        } else {
            updateTabConfirm(newTab);
        }
    };

    const updateTabConfirm = (newTab: string) => {
        const tab = newTab as ChannelSettingsTabs;
        setActiveTab(tab);
        setActiveTab(newTab as ChannelSettingsTabs);

        // Scroll to top if user changes tabs
        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    };

    // Temporal: Confirm modal logic
    const showConfirm = (afterConfirm?: () => void) => {
        if (customConfirmAction) {
            customConfirmAction(() => handleConfirm(afterConfirm));
            return;
        }
        setShowConfirmModal(true);
        setEnforceFocus(false);
    };

    const handleConfirm = (afterConfirm?: () => void) => {
        setShowConfirmModal(false);
        setEnforceFocus(true);
        setRequireConfirm(false);
        setCustomConfirmAction(null);

        if (afterConfirm) {
            afterConfirm();
        }
    };

    const handleCancelConfirmation = () => {
        setShowConfirmModal(false);
        setEnforceFocus(true);
    };

    const handleHide = () => {
        if (requireConfirm) {
            showConfirm(() => handleHideConfirm());
        } else {
            handleHideConfirm();
        }
    };

    const handleHideConfirm = () => {
        stopTryNotificationRing();
        setShow(false);
    };

    // Called after the fade-out completes
    const handleHidden = () => {
        // Clear anything if needed
        setActiveTab(ChannelSettingsTabs.INFO);
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
        onExited();
    };

    // Validate & Save
    const handleSave = async () => {
        if (!channel) {
            return;
        }

        // TODO: expand this simple example of the client-side check, enhance and cover all scenarios shown int he UX
        if (!displayName.trim()) {
            setServerError(formatMessage({
                id: 'channel_settings.error_display_name_required',
                defaultMessage: 'Channel name is required',
            }));
            return;
        }

        // Build updated channel object
        const updated: Channel = {
            ...channel,
            display_name: displayName.trim(),
            name: url.trim(),
            purpose: channelPurpose.trim(),
            header: header.trim(),
            type: channelType as ChannelType,
        };

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return;
        }

        // On success, close the modal
        handleHideConfirm();
    };

    const handleServerError = (err: ServerError) => {
        setServerError(err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'}));
    };

    // Example of toggling from open <-> private
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

    const handleArchiveChannel = () => {
        if (requireConfirm) {
            showConfirm(() => doArchiveChannel());
        } else {
            doArchiveChannel();
        }
    };

    const doArchiveChannel = () => {
        // TODO: add the extra logic to archive the channel
        handleHideConfirm();
    };

    // Renders content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
        case ChannelSettingsTabs.INFO:
            return renderInfoTab();
        case ChannelSettingsTabs.CONFIGURATION:
            return renderConfigurationTab();
        case ChannelSettingsTabs.ARCHIVE:
            return renderArchiveTab();
        default:
            return renderInfoTab();
        }
    };

    const handleURLChange = useCallback((newURL: string) => {
        setURL(newURL);
        setURLError('');
    }, []);

    const renderInfoTab = () => {
        // Channel name, URL, purpose, header, plus the public/private toggle
        return (
            <div className='ChannelSettingsModal__infoTab'>
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
                    currentUrl={channel.name}
                />

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
                <label className='Input_legend'>{formatMessage({id: 'channel_settings.label.purpose', defaultMessage: 'Channel Purpose'})}</label>
                <div className='ChannelSettingsModal__purposeContainer'>
                    <textarea
                        className={classNames('channel-settings-modal__purpose-input')}
                        placeholder={formatMessage({
                            id: 'channel_settings_modal.purpose.placeholder',
                            defaultMessage: 'Enter a purpose for this channel (optional)',
                        })}
                        rows={4}
                        maxLength={Constants.MAX_CHANNELPURPOSE_LENGTH}
                        value={channelPurpose}
                        onChange={(e) => {
                            setChannelPurpose(e.target.value);
                        }}
                    />
                </div>
                <div className='ChannelSettingsModal__headerContainer'>
                    <div className='ChannelSettingsModal__headerContainer--preview-button'>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                        >
                            <i className='icon icon-eye-outline'/>
                        </button>
                    </div>
                    <textarea
                        className={classNames('channel-settings-modal__header-input')}
                        placeholder={formatMessage({
                            id: 'channel_settings_modal.header.placeholder',
                            defaultMessage: 'Enter a header for this channel',
                        })}
                        rows={showPreview ? 2 : 4}
                        value={channel.header}
                        onChange={(e) => {
                            setChannelHeader(e.target.value);
                        }}
                    />
                    {showPreview && (
                        <div className='channel-settings-modal__header-preview'>
                            {/* The markdown preview will be here, an existing component will be modified and made generic, I think the existing one can be extended in a next iteration */}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderConfigurationTab = () => {
        // Could show channel permissions, guest/member permissions, etc.
        return (
            <div className='ChannelSettingsModal__configurationTab'>
                <FormattedMessage
                    id='channel_settings.configuration.placeholder'
                    defaultMessage='Channel Permissions or Additional Configuration (WIP)'
                />
            </div>
        );
    };

    const renderArchiveTab = () => {
        return (
            <div className='ChannelSettingsModal__archiveTab'>
                <FormattedMessage
                    id='channel_settings.archive.warning'
                    defaultMessage='Archiving this channel will remove it from the channel list. Are you sure you want to proceed?'
                />
                <button
                    type='button'
                    className='btn btn-danger'
                    onClick={handleArchiveChannel}
                >
                    <FormattedMessage
                        id='channel_settings.archive.button'
                        defaultMessage='Archive Channel'
                    />
                </button>
            </div>
        );
    };

    // Renders the body: left sidebar for tabs, the content on the right
    const renderModalBody = () => {
        return (
            <div
                ref={modalBodyRef}
                className='ChannelSettingsModal__bodyWrapper'
            >
                <div className='settings-table'>
                    {/* Left Sidebar */}
                    <div className='settings-links'>
                        <ChannelSettingsSidebar
                            activeTab={activeTab}
                            setActiveTab={(id: string) => updateTab(id)}
                            tabs={[
                                {id: ChannelSettingsTabs.INFO, label: formatMessage({id: 'channel_settings.tab.info', defaultMessage: 'Info'})},
                                {id: ChannelSettingsTabs.CONFIGURATION, label: formatMessage({id: 'channel_settings.tab.configuration', defaultMessage: 'Configuration'})},
                                {id: ChannelSettingsTabs.ARCHIVE, label: formatMessage({id: 'channel_settings.tab.archive', defaultMessage: 'Archive Channel'})},
                            ]}
                        />
                    </div>
                    {/* Main content on the right */}
                    <div className='settings-content minimize-settings'>
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        );
    };

    // For the main modal heading
    const modalTitle = formatMessage({id: 'channel_settings.modal.title', defaultMessage: 'Channel Settings'});

    // Error text to show in the GenericModal “footer area”
    const errorText = serverError;

    return (
        <GenericModal
            id='channelSettingsModal'
            ariaLabel={modalTitle}
            className='ChannelSettingsModal'
            show={show}
            onHide={handleHide}
            onExited={handleHidden}
            compassDesign={true}
            enforceFocus={enforceFocus}

            // The main heading:
            modalHeaderText={modalTitle}
            errorText={errorText}

            // Primary “Save” or “Update” button text
            confirmButtonText={formatMessage({id: 'channel_settings.modal.save', defaultMessage: 'Save changes'})}
            cancelButtonText={formatMessage({id: 'channel_settings.modal.cancel', defaultMessage: 'Cancel'})}

            // If there are no changes or any field is invalid, disable “Save”
            isConfirmDisabled={!hasUnsavedChanges() || Boolean(urlError || serverError)}

            // When user clicks “Save”
            handleConfirm={handleSave}

            // If pressing Enter in a sub‐form, we also want to handle saving:
            handleEnterKeyPress={handleSave}
            handleCancel={handleHide}
            autoCloseOnConfirmButton={false}
        >
            {renderModalBody()}

            {/* Temporal used - ConfirmModal for unsaved changes - this will be updated to the bottom alert banner as shown in the designs */}
            <ConfirmModal
                show={showConfirmModal}
                title={formatMessage({id: 'channel_settings.modal.confirmTitle', defaultMessage: 'Discard Changes?'})}
                message={formatMessage({id: 'channel_settings.modal.confirmMsg', defaultMessage: 'You have unsaved changes. Are you sure you want to discard them?'})}
                confirmButtonText={formatMessage({id: 'channel_settings.modal.confirmDiscard', defaultMessage: 'Yes, Discard'})}
                onConfirm={() => handleConfirm()}
                onCancel={handleCancelConfirmation}
            />
        </GenericModal>
    );
}

export default ChannelSettingsModal;
