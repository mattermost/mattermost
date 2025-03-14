// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {a11yFocus} from 'utils/utils';

export type Tab = {
    icon: string | {url: string};
    iconTitle: string;
    name: string;
    uiName: string;
    newGroup?: boolean;
    display?: boolean; // Controls whether the tab is displayed, defaults to true
}

export type Props = {
    activeTab?: string;
    tabs: Tab[];
    pluginTabs?: Tab[];
    updateTab: (name: string) => void;
    isMobileView: boolean;
};

export default class SettingsSidebar extends React.PureComponent<Props> {
    buttonRefs: Array<RefObject<HTMLButtonElement>>;
    totalTabs: Tab[];

    constructor(props: Props) {
        super(props);

        // Filter out tabs where display is explicitly set to false
        const filteredTabs = this.props.tabs.filter((tab) => tab.display !== false);
        const filteredPluginTabs = this.props.pluginTabs?.filter((tab) => tab.display !== false) || [];
        this.totalTabs = [...filteredTabs, ...filteredPluginTabs];
        this.buttonRefs = this.totalTabs.map(() => React.createRef());
    }

    public handleClick = (tab: Tab, e: React.MouseEvent) => {
        e.preventDefault();
        this.props.updateTab(tab.name);
        (e.target as Element).closest('.settings-modal')?.classList.add('display--content');
    };

    public handleKeyUp = (index: number, e: React.KeyboardEvent) => {
        if (isKeyPressed(e, Constants.KeyCodes.UP)) {
            if (index > 0) {
                this.props.updateTab(this.totalTabs[index - 1].name);
                a11yFocus(this.buttonRefs[index - 1].current);
            } else {
                this.props.updateTab(this.totalTabs[this.totalTabs.length - 1].name);
                a11yFocus(this.buttonRefs[this.buttonRefs.length - 1].current);
            }
        } else if (isKeyPressed(e, Constants.KeyCodes.DOWN)) {
            if (index < this.totalTabs.length - 1) {
                this.props.updateTab(this.totalTabs[index + 1].name);
                a11yFocus(this.buttonRefs[index + 1].current);
            } else {
                this.props.updateTab(this.totalTabs[0].name);
                a11yFocus(this.buttonRefs[0].current);
            }
        }
    };

    private renderTab(tab: Tab, index: number) {
        const key = `${tab.name}_li`;
        const isActive = this.props.activeTab === tab.name;

        let icon;
        if (typeof tab.icon === 'string') {
            icon = (
                <i
                    className={tab.icon}
                    title={tab.iconTitle}
                />
            );
        } else {
            icon = (
                <img
                    src={tab.icon.url}
                    alt={tab.iconTitle}
                    className='icon'
                />
            );
        }

        return (
            <React.Fragment key={key}>
                {tab.newGroup && <hr/>}
                <button
                    ref={this.buttonRefs[index]}
                    id={`${tab.name}Button`}
                    className={classNames('cursor--pointer style--none nav-pills__tab', {active: isActive})}
                    onClick={this.handleClick.bind(null, tab)}
                    onKeyUp={this.handleKeyUp.bind(null, index)}
                    aria-label={tab.uiName.toLowerCase()}
                    role='tab'
                    aria-selected={isActive}
                    tabIndex={!isActive && !this.props.isMobileView ? -1 : 0}
                    aria-controls={`${tab.name}Settings`}
                >
                    {icon}
                    {tab.uiName}
                </button>
            </React.Fragment>
        );
    }

    public render() {
        // Filter tabs where display is explicitly set to false
        const visibleTabs = this.props.tabs.filter((tab) => tab.display !== false);
        const tabList = visibleTabs.map((tab, index) => this.renderTab(tab, index));

        let pluginTabList: React.ReactNode;
        if (this.props.pluginTabs?.length) {
            const visiblePluginTabs = this.props.pluginTabs.filter((tab) => tab.display !== false);
            if (visiblePluginTabs.length) {
                pluginTabList = (
                    <>
                        <hr/>
                        <div
                            role='group'
                            aria-labelledby='userSettingsModal.pluginPreferences.header'
                        >
                            <div
                                key={'plugin preferences heading'}
                                role='heading'
                                className={'header'}
                                aria-level={3}
                                id='userSettingsModal_pluginPreferences_header'
                            >
                                <FormattedMessage
                                    id={'userSettingsModal.pluginPreferences.header'}
                                    defaultMessage={'PLUGIN PREFERENCES'}
                                />
                            </div>
                            {visiblePluginTabs.map((tab, index) => this.renderTab(tab, visibleTabs.length + index))}
                        </div>
                    </>
                );
            }
        }

        return (
            <div
                id='tabList'
                className='nav nav-pills nav-stacked'
                role='tablist'
                aria-orientation='vertical'
            >
                <div role='group'>
                    {tabList}
                </div>
                {pluginTabList}
            </div>
        );
    }
}
