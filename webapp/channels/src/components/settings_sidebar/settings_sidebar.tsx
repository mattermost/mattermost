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
        this.totalTabs = [...this.props.tabs, ...this.props.pluginTabs || []];
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
            <button
                key={key}
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
        );
    }

    public render() {
        const tabList = this.props.tabs.map((tab, index) => this.renderTab(tab, index));
        let pluginTabList: React.ReactNode;
        if (this.props.pluginTabs?.length) {
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
                        {this.props.pluginTabs.map((tab, index) => this.renderTab(tab, index + this.props.tabs.length))}
                    </div>
                </>
            );
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
