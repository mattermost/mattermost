// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AdvancedTab from './advanced';
import DisplayTab from './display';
import GeneralTab from './general';
import NotificationsTab from './notifications';
import SecurityTab from './security';
import SidebarTab from './sidebar';

import type {UserProfile} from '@mattermost/types/users';

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
};

export default class UserSettings extends React.PureComponent<Props> {
    render() {
        if (this.props.activeTab === 'profile') {
            return (
                <div>
                    <GeneralTab
                        user={this.props.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        updateTab={this.props.updateTab}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'security') {
            return (
                <div>
                    <SecurityTab
                        user={this.props.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                        setRequireConfirm={this.props.setRequireConfirm}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'notifications') {
            return (
                <div>
                    <NotificationsTab
                        user={this.props.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'display') {
            return (
                <div>
                    <DisplayTab
                        user={this.props.user}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                        setEnforceFocus={this.props.setEnforceFocus}
                        setRequireConfirm={this.props.setRequireConfirm}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'sidebar') {
            return (
                <div>
                    <SidebarTab
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        } else if (this.props.activeTab === 'advanced') {
            return (
                <div>
                    <AdvancedTab
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        closeModal={this.props.closeModal}
                        collapseModal={this.props.collapseModal}
                    />
                </div>
            );
        }

        return <div/>;
    }
}
