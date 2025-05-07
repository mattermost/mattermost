// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useState,
    useRef,
} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';
import {selectChannelBannerEnabled} from 'mattermost-redux/selectors/entities/channel_banner';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
} from 'actions/views/textbox';

import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import ChannelSettingsArchiveTab from './channel_settings_archive_tab';
import ChannelSettingsConfigurationTab from './channel_settings_configuration_tab';
import ChannelSettingsInfoTab from './channel_settings_info_tab';

import './channel_settings_modal.scss';

// Lazy-loaded components
const SettingsSidebar = React.lazy(() => import('components/settings_sidebar'));

type ChannelSettingsModalProps = {
    channelId: string;
    onExited: () => void;
    isOpen: boolean;
    focusOriginElement?: string;
};

enum ChannelSettingsTabs {
    INFO = 'info',
    CONFIGURATION = 'configuration',
    ARCHIVE = 'archive',
}

const SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT = 3000;

function ChannelSettingsModal({channelId, isOpen, onExited, focusOriginElement}: ChannelSettingsModalProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId)) as Channel;
    const channelBannerEnabled = useSelector(selectChannelBannerEnabled);

    const canManagePublicChannelBanner = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_BANNER),
    );
    const canManagePrivateChannelBanner = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_BANNER),
    );
    const hasManageChannelBannerPermission = (channel.type === 'O' && canManagePublicChannelBanner) || (channel.type === 'P' && canManagePrivateChannelBanner);

    const shouldShowConfigurationTab = channelBannerEnabled && hasManageChannelBannerPermission;

    const canArchivePrivateChannels = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DELETE_PRIVATE_CHANNEL),
    );

    const canArchivePublicChannels = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DELETE_PUBLIC_CHANNEL),
    );

    const [show, setShow] = useState(isOpen);

    // Active tab
    const [activeTab, setActiveTab] = useState<ChannelSettingsTabs>(ChannelSettingsTabs.INFO);

    // State for showing error in the save changes panel when trying to switch tabs with unsaved changes
    const [showTabSwitchError, setShowTabSwitchError] = useState(false);

    // State to track if there are unsaved changes
    const [areThereUnsavedChanges, setAreThereUnsavedChanges] = useState(false);

    // Refs
    const modalBodyRef = useRef<HTMLDivElement>(null);

    // Called to set the active tab, prompting save changes panel if there are unsaved changes
    const updateTab = (newTab: string) => {
        /**
         * If there are unsaved changes, show an error in the save changes panel
         * and reset it after a timeout to indicate the user needs to save or discard changes
         * before switching tabs.
         */
        if (areThereUnsavedChanges) {
            setShowTabSwitchError(true);
            setTimeout(() => {
                setShowTabSwitchError(false);
            }, SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT);
            return;
        }

        const tab = newTab as ChannelSettingsTabs;
        setActiveTab(tab);

        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    };

    const handleHide = () => {
        handleHideConfirm();
    };

    const handleHideConfirm = () => {
        // Reset preview states to false when closing the modal
        dispatch(setShowPreviewOnChannelSettingsHeaderModal(false));
        dispatch(setShowPreviewOnChannelSettingsPurposeModal(false));
        setShow(false);
    };

    // Called after the fade-out completes
    const handleExited = () => {
        // Clear anything if needed
        setActiveTab(ChannelSettingsTabs.INFO);
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
        onExited();
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

    const renderInfoTab = () => {
        return (
            <ChannelSettingsInfoTab
                channel={channel}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
            />
        );
    };

    const renderConfigurationTab = () => {
        return (
            <ChannelSettingsConfigurationTab
                channel={channel}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
            />
        );
    };

    const renderArchiveTab = () => {
        return (
            <ChannelSettingsArchiveTab
                channel={channel}
                onHide={handleHideConfirm}
            />
        );
    };

    // Define tabs for the settings sidebar
    const tabs = [
        {
            name: ChannelSettingsTabs.INFO,
            uiName: formatMessage({id: 'channel_settings.tab.info', defaultMessage: 'Info'}),
            icon: 'icon icon-information-outline',
            iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'}),
        },
        {
            name: ChannelSettingsTabs.CONFIGURATION,
            uiName: formatMessage({id: 'channel_settings.tab.configuration', defaultMessage: 'Configuration'}),
            icon: 'icon icon-cog-outline',
            iconTitle: formatMessage({id: 'generic_icons.settings', defaultMessage: 'Settings Icon'}),
            display: shouldShowConfigurationTab,
        },
        {
            name: ChannelSettingsTabs.ARCHIVE,
            uiName: formatMessage({id: 'channel_settings.tab.archive', defaultMessage: 'Archive Channel'}),
            icon: 'icon icon-archive-outline',
            iconTitle: formatMessage({id: 'generic_icons.archive', defaultMessage: 'Archive Icon'}),
            newGroup: true,
            display: channel.name !== Constants.DEFAULT_CHANNEL && // archive is not available for the default channel
                ((channel.type === Constants.PRIVATE_CHANNEL && canArchivePrivateChannels) ||
                (channel.type === Constants.OPEN_CHANNEL && canArchivePublicChannels)),
        },
    ];

    // Renders the body: left sidebar for tabs, the content on the right
    const renderModalBody = () => {
        return (
            <div
                ref={modalBodyRef}
                className='settings-table'
            >
                <div className='settings-links'>
                    <React.Suspense fallback={null}>
                        <SettingsSidebar
                            tabs={tabs}
                            activeTab={activeTab}
                            updateTab={updateTab}
                        />
                    </React.Suspense>
                </div>
                <div className='settings-content minimize-settings'>
                    {renderTabContent()}
                </div>
            </div>
        );
    };

    const modalTitle = formatMessage({id: 'channel_settings.modal.title', defaultMessage: 'Channel Settings'});

    return (
        <GenericModal
            id='channelSettingsModal'
            ariaLabel={modalTitle}
            className='ChannelSettingsModal settings-modal'
            show={show}
            onHide={handleHide}
            onExited={handleExited}
            compassDesign={true}
            modalHeaderText={modalTitle}
            bodyPadding={false}
            modalLocation={'top'}
        >
            <div className='ChannelSettingsModal__bodyWrapper'>
                {renderModalBody()}
            </div>
        </GenericModal>
    );
}

export default ChannelSettingsModal;
