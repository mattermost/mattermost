// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import LimitVisibleGMsDMs from './limit_visible_gms_dms';
import ShowUnreadsCategory from './show_unreads_category';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

export interface Props {
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
}

export default function UserSettingsSidebar(props: Props): JSX.Element {
    return (
        <div>
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
                />
                <div className='divider-dark'/>
                <LimitVisibleGMsDMs
                    active={props.activeSection === 'limitVisibleGMsDMs'}
                    updateSection={props.updateSection}
                    areAllSectionsInactive={props.activeSection === ''}
                />
                <div className='divider-dark'/>
            </div>
        </div>
    );
}
