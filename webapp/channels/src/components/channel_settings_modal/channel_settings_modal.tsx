// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useEffect,
    useMemo,
    useState,
    useRef,
} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
} from 'actions/views/textbox';
import {isChannelAccessControlEnabled} from 'selectors/general';
import {getVisibleChannelSettingsTabs} from 'selectors/plugins';

import type {Tab as SidebarTab} from 'components/settings_sidebar/settings_sidebar';

import Pluggable from 'plugins/pluggable';
import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';
import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';
import {isValidUrl} from 'utils/url';

import type {GlobalState} from 'types/store';

import ChannelSettingsAccessRulesTab from './channel_settings_access_rules_tab';
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

const BuiltInTabIds = {
    INFO: 'info',
    ACCESS_RULES: 'access_rules',
    CONFIGURATION: 'configuration',
    ARCHIVE: 'archive',
} as const;
type BuiltInTabId = typeof BuiltInTabIds[keyof typeof BuiltInTabIds];

const builtInTabIdSet = new Set<BuiltInTabId>(Object.values(BuiltInTabIds));
const PLUGIN_TAB_PREFIX = 'plugin_';

const SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT = 3000;

function getPluginTabName(registrationId: string): string {
    return `${PLUGIN_TAB_PREFIX}${registrationId}`;
}

function getPluginRegistrationId(tabName: string): string | undefined {
    if (!tabName.startsWith(PLUGIN_TAB_PREFIX)) {
        return undefined;
    }

    const registrationId = tabName.slice(PLUGIN_TAB_PREFIX.length);
    return registrationId || undefined;
}

function isBuiltInTabId(tabName: string): tabName is BuiltInTabId {
    return builtInTabIdSet.has(tabName as BuiltInTabId);
}

function getPreferredActiveTab(activeTab: string, visibleBuiltInTabs: SidebarTab[], visiblePluginTabs: SidebarTab[]): string {
    const visibleTabNames = [...visibleBuiltInTabs, ...visiblePluginTabs].map((tab) => tab.name);
    if (visibleTabNames.includes(activeTab)) {
        return activeTab;
    }

    return visibleBuiltInTabs[0]?.name ?? visiblePluginTabs[0]?.name ?? BuiltInTabIds.INFO;
}

function ChannelSettingsModal({channelId, isOpen, onExited, focusOriginElement}: ChannelSettingsModalProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId)) as Channel;
    const visiblePluginTabRegistrations = useSelector((state: GlobalState) => getVisibleChannelSettingsTabs(state, channelId));
    const channelBannerEnabled = isMinimumEnterpriseAdvancedLicense(useSelector(getLicense));

    const canManagePublicChannelBanner = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_BANNER),
    );
    const canManagePrivateChannelBanner = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_BANNER),
    );
    const hasManageChannelBannerPermission = (channel.type === 'O' && canManagePublicChannelBanner) || (channel.type === 'P' && canManagePrivateChannelBanner);

    const canManageChannelTranslation = useSelector((state: GlobalState) => {
        const config = getConfig(state);
        if (config?.EnableAutoTranslation !== 'true') {
            return false;
        }

        const isDMorGM = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
        if (isDMorGM && config?.RestrictDMAndGMAutotranslation === 'true') {
            return false;
        }

        const permissionToCheck = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_AUTO_TRANSLATION : Permissions.MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION;
        return haveIChannelPermission(state, channel.team_id, channel.id, permissionToCheck);
    });

    const canManageBanner = channelBannerEnabled && hasManageChannelBannerPermission;
    const shouldShowConfigurationTab = canManageBanner || canManageChannelTranslation;

    const canArchivePrivateChannels = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DELETE_PRIVATE_CHANNEL),
    );

    const canArchivePublicChannels = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DELETE_PUBLIC_CHANNEL),
    );

    const canManageChannelAccessRules = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_CHANNEL_ACCESS_RULES),
    );

    const channelAdminABACControlEnabled = useSelector(isChannelAccessControlEnabled);

    const shouldShowAccessRulesTab = channelAdminABACControlEnabled && canManageChannelAccessRules && channel.type === Constants.PRIVATE_CHANNEL && !channel.group_constrained;

    const [show, setShow] = useState(isOpen);

    // Active tab
    const [activeTab, setActiveTab] = useState<string>(BuiltInTabIds.INFO);

    // State for showing error in the save changes panel when trying to switch tabs with unsaved changes
    const [showTabSwitchError, setShowTabSwitchError] = useState(false);

    // State to track if there are unsaved changes
    const [areThereUnsavedChanges, setAreThereUnsavedChanges] = useState(false);

    // State to track if user has been warned about unsaved changes
    const [hasBeenWarned, setHasBeenWarned] = useState(false);

    // Refs
    const modalBodyRef = useRef<HTMLDivElement>(null);
    const pluginSectionLabel = formatMessage({
        id: 'channel_settings.sidebar.plugin_settings',
        defaultMessage: 'PLUGIN SETTINGS',
    });

    const tabs = useMemo((): SidebarTab[] => {
        return [
            {
                name: BuiltInTabIds.INFO,
                uiName: formatMessage({id: 'channel_settings.tab.info', defaultMessage: 'Info'}),
                icon: 'icon icon-information-outline',
                iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'}),
            },
            {
                name: BuiltInTabIds.ACCESS_RULES,
                uiName: formatMessage({id: 'channel_settings.tab.access_control', defaultMessage: 'Access Control'}),
                icon: 'icon icon-shield-outline',
                iconTitle: formatMessage({id: 'generic_icons.access_rules', defaultMessage: 'Access Rules Icon'}),
                display: shouldShowAccessRulesTab,
            },
            {
                name: BuiltInTabIds.CONFIGURATION,
                uiName: formatMessage({id: 'channel_settings.tab.configuration', defaultMessage: 'Configuration'}),
                icon: 'icon icon-cog-outline',
                iconTitle: formatMessage({id: 'generic_icons.settings', defaultMessage: 'Settings Icon'}),
                display: shouldShowConfigurationTab,
            },
            {
                name: BuiltInTabIds.ARCHIVE,
                uiName: formatMessage({id: 'channel_settings.tab.archive', defaultMessage: 'Archive Channel'}),
                icon: 'icon icon-archive-outline',
                iconTitle: formatMessage({id: 'generic_icons.archive', defaultMessage: 'Archive Icon'}),
                display: channel.name !== Constants.DEFAULT_CHANNEL &&
                    ((channel.type === Constants.PRIVATE_CHANNEL && canArchivePrivateChannels) ||
                    (channel.type === Constants.OPEN_CHANNEL && canArchivePublicChannels)),
            },
        ];
    }, [
        canArchivePrivateChannels,
        canArchivePublicChannels,
        channel.name,
        channel.type,
        formatMessage,
        shouldShowAccessRulesTab,
        shouldShowConfigurationTab,
    ]);

    const pluginTabs = useMemo((): SidebarTab[] => {
        return visiblePluginTabRegistrations.map((registration) => {
            let icon: SidebarTab['icon'] = 'icon icon-power-plug-outline';
            if (registration.icon) {
                if (isValidUrl(registration.icon) || registration.icon.startsWith('/')) {
                    icon = {url: registration.icon};
                } else {
                    icon = `icon ${registration.icon}`;
                }
            }

            return {
                name: getPluginTabName(registration.id),
                uiName: registration.uiName,
                iconTitle: registration.uiName,
                icon,
            };
        });
    }, [visiblePluginTabRegistrations]);

    const visibleBuiltInTabs = useMemo(() => tabs.filter((tab) => tab.display !== false), [tabs]);
    const visiblePluginTabs = useMemo(() => pluginTabs.filter((tab) => tab.display !== false), [pluginTabs]);
    const visibleTabNames = useMemo(() => [...visibleBuiltInTabs, ...visiblePluginTabs].map((tab) => tab.name), [visibleBuiltInTabs, visiblePluginTabs]);
    const preferredActiveTab = useMemo(() => getPreferredActiveTab(activeTab, visibleBuiltInTabs, visiblePluginTabs), [activeTab, visibleBuiltInTabs, visiblePluginTabs]);
    const activePluginRegistration = useMemo(() => {
        const registrationId = getPluginRegistrationId(activeTab);
        if (!registrationId) {
            return undefined;
        }

        return visiblePluginTabRegistrations.find((registration) => registration.id === registrationId);
    }, [activeTab, visiblePluginTabRegistrations]);

    useEffect(() => {
        if (preferredActiveTab !== activeTab) {
            setActiveTab(preferredActiveTab);
        }
    }, [activeTab, preferredActiveTab, visibleTabNames]);

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

        setActiveTab(newTab);

        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    };

    const handleHide = () => {
        // Prevent modal closing if there are unsaved changes (warn once, then allow)
        if (areThereUnsavedChanges && !hasBeenWarned) {
            setHasBeenWarned(true);

            // Show error message in SaveChangesPanel
            setShowTabSwitchError(true);
            setTimeout(() => {
                setShowTabSwitchError(false);
            }, SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT);
        } else {
            handleHideConfirm();
        }
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
        setActiveTab(BuiltInTabIds.INFO);
        setHasBeenWarned(false);
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
        onExited();
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
                canManageChannelTranslation={canManageChannelTranslation}
                canManageBanner={canManageBanner}
            />
        );
    };

    const renderAccessRulesTab = () => {
        return (
            <ChannelSettingsAccessRulesTab
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

    const renderBuiltInTabContent = (tab: BuiltInTabId) => {
        switch (tab) {
        case BuiltInTabIds.INFO:
            return renderInfoTab();
        case BuiltInTabIds.ACCESS_RULES:
            return renderAccessRulesTab();
        case BuiltInTabIds.CONFIGURATION:
            return renderConfigurationTab();
        case BuiltInTabIds.ARCHIVE:
            return renderArchiveTab();
        default: {
            const exhaustiveCheck: never = tab;
            return exhaustiveCheck;
        }
        }
    };

    // Renders content based on active tab
    const renderTabContent = () => {
        if (activePluginRegistration) {
            return (
                <Pluggable
                    pluggableName='ChannelSettingsTab'
                    pluggableId={activePluginRegistration.id}
                    channel={channel}
                    setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                    showTabSwitchError={showTabSwitchError}
                />
            );
        }

        return renderBuiltInTabContent(isBuiltInTabId(activeTab) ? activeTab : BuiltInTabIds.INFO);
    };

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
                            pluginTabs={pluginTabs}
                            pluginSectionLabel={pluginSectionLabel}
                            pluginSectionHeadingId='channelSettingsModal_pluginSettings_header'
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
            preventClose={areThereUnsavedChanges && !hasBeenWarned}
            onExited={handleExited}
            compassDesign={true}
            modalHeaderText={modalTitle}
            bodyPadding={false}
            modalLocation={'top'}
            enforceFocus={false}
        >
            <div className='ChannelSettingsModal__bodyWrapper'>
                {renderModalBody()}
            </div>
        </GenericModal>
    );
}

export default ChannelSettingsModal;
