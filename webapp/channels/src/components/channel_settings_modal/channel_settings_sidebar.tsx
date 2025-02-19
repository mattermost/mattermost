// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

// A simple type for each tab the sidebar will display.
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
 * Renders a vertical list of tabs (e.g., "Info", "Configuration", "Archive Channel") on the left side.
 * Selecting a tab calls `setActiveTab(id)`, which your parent component (ChannelSettingsModal)
 * will use to show the right content.
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
                            className={classNames('ChannelSettingsSidebar__tabItem', {
                                active: isActive,
                            })}
                        >
                            <button
                                type='button'
                                onClick={() => setActiveTab(tab.id)}
                                className='ChannelSettingsSidebar__tabButton'
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
