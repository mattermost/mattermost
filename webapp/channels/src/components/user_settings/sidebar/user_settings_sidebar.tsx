// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferencesType} from '@mattermost/types/preferences';

import LimitVisibleGMsDMs from './limit_visible_gms_dms';
import ShowUnreadsCategory from './show_unreads_category';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

export interface Props {
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
    adminMode?: boolean;
    userId: string;
    userPreferences?: PreferencesType;
}

export default function UserSettingsSidebar(props: Props): JSX.Element {
    return (
        <div
            id='sidebarSettings'
            aria-labelledby='sidebarButton'
            role='tabpanel'
        >
            <SettingMobileHeader
                closeModal={props.closeModal}
                collapseModal={props.collapseModal}
                text={
                    <FormattedMessage
                        id='user.settings.sidebar.title'
                        defaultMessage='Sidebar Settings'
                    />
                }
            />
            <div
                id='sidebarTitle'
                className='user-settings'
            >
                <SettingDesktopHeader
                    text={
                        <FormattedMessage
                            id='user.settings.sidebar.title'
                            defaultMessage='Sidebar Settings'
                        />
                    }
                />

                <div className='divider-dark first'/>
                <ShowUnreadsCategory
                    active={props.activeSection === 'showUnreadsCategory'}
                    updateSection={props.updateSection}
                    areAllSectionsInactive={props.activeSection === ''}
                    adminMode={props.adminMode}
                    userId={props.userId}
                    userPreferences={props.userPreferences}
                />
                <div className='divider-dark'/>
                <LimitVisibleGMsDMs
                    active={props.activeSection === 'limitVisibleGMsDMs'}
                    updateSection={props.updateSection}
                    areAllSectionsInactive={props.activeSection === ''}
                    adminMode={props.adminMode}
                    userId={props.userId}
                    userPreferences={props.userPreferences}
                />
                <div className='divider-dark'/>
            </div>
        </div>
    );
}
