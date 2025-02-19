// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// channels/src/components/channel_settings_modal/channel_settings_sidebar.tsx

import React from 'react';
import classNames from 'classnames';
import {useIntl} from 'react-intl';

// IMPORTANT: Import the SCSS so the styling actually applies
import './channel_settings_sidebar.scss';

type TabOption = {
    id: string;
    label: string;
};

type ChannelSettingsSidebarProps = {
    tabs: TabOption[];
    activeTab: string;
    setActiveTab: (id: string) => void;
};

/**
 * ChannelSettingsSidebar
 *
 * Renders a vertical list of tabs (e.g. "Info", "Configuration", "Archive Channel") on the left side.
 * Each tab is a <button> in a <li>, styled to match other Mattermost sidebars.
 */
export default function ChannelSettingsSidebar(props: ChannelSettingsSidebarProps) {
    const {formatMessage} = useIntl();
    const {tabs, activeTab, setActiveTab} = props;

    return (
        <nav
            className='ChannelSettingsSidebar'
            aria-label={formatMessage({id: 'channel_settings.sidebar.aria_label', defaultMessage: 'Channel Settings Navigation'})}
        >
            <ul className='ChannelSettingsSidebar__list'>
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTab;
                    return (
                        <li
                            key={tab.id}
                            className={classNames('ChannelSettingsSidebar__tabItem', {active: isActive})}
                        >
                            <button
                                type='button'
                                className='ChannelSettingsSidebar__tabButton'
                                onClick={() => setActiveTab(tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {tab.label}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

