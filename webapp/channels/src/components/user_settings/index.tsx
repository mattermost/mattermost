// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PreferencesType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import AdvancedDisplaySettings from 'components/user_settings_modal/advanced_display_settings';

import type {PluginConfiguration} from 'types/plugins/user_settings';

import DisplayTab from './display';
import GeneralTab from './general';
import NotificationsTab from './notifications';
import PluginTab from './plugin';
import SecurityTab from './security';
import SidebarTab from './sidebar';
import './index.scss';

export type Props = {
    user: UserProfile;
    activeTab?: string;
    activeSection: string;
    updateSection: (section?: string) => void;
    updateTab: (notifications: string) => void;
    closeModal: () => void;
    collapseModal: () => void;
    setEnforceFocus: () => void;
    setRequireConfirm: () => void;
    pluginSettings: {[tabName: string]: PluginConfiguration};
    userPreferences?: PreferencesType;
    adminMode?: boolean;
};

export default function UserSettings(props: Props) {
    if (props.activeTab === 'profile') {
        return (
            <div>
                <GeneralTab
                    user={props.user}
                    activeSection={props.activeSection}
                    updateSection={props.updateSection}
                    updateTab={props.updateTab}
                    closeModal={props.closeModal}
                    collapseModal={props.collapseModal}
                />
            </div>
        );
    } else if (props.activeTab === 'security') {
        return (
            <div>
                <SecurityTab
                    user={props.user}
                    activeSection={props.activeSection}
                    updateSection={props.updateSection}
                    closeModal={props.closeModal}
                    collapseModal={props.collapseModal}
                    setRequireConfirm={props.setRequireConfirm}
                />
            </div>
        );
    } else if (props.activeTab === 'notifications') {
        return (
            <div>
                <NotificationsTab
                    user={props.user}
                    activeSection={props.activeSection}
                    updateSection={props.updateSection}
                    closeModal={props.closeModal}
                    collapseModal={props.collapseModal}
                    adminMode={props.adminMode}
                    userPreferences={props.userPreferences}
                />
            </div>
        );
    } else if (props.activeTab === 'display') {
        return (
            <div>
                <DisplayTab
                    user={props.user}
                    activeSection={props.activeSection}
                    updateSection={props.updateSection}
                    closeModal={props.closeModal}
                    collapseModal={props.collapseModal}
                    setEnforceFocus={props.setEnforceFocus}
                    setRequireConfirm={props.setRequireConfirm}
                    adminMode={props.adminMode}
                    userPreferences={props.userPreferences}
                />
            </div>
        );
    } else if (props.activeTab === 'sidebar') {
        return (
            <div>
                <SidebarTab
                    activeSection={props.activeSection}
                    updateSection={props.updateSection}
                    closeModal={props.closeModal}
                    collapseModal={props.collapseModal}
                    adminMode={props.adminMode}
                    userId={props.user.id}
                    userPreferences={props.userPreferences}
                />
            </div>
        );
    } else if (props.activeTab === 'advanced') {
        return (
            <div className='user-settings__content'>
                <AdvancedDisplaySettings userId={props.user.id}/>
            </div>
        );
    } else if (props.activeTab && props.pluginSettings[props.activeTab]) {
        return (
            <div>
                <PluginTab
                    activeSection={props.activeSection}
                    updateSection={props.updateSection}
                    closeModal={props.closeModal}
                    collapseModal={props.collapseModal}
                    settings={props.pluginSettings[props.activeTab]}
                />
            </div>
        );
    }

    return null;
}
