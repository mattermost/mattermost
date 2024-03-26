// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

    constructor(props: Props) {
        super(props);
        this.buttonRefs = this.props.tabs.map(() => React.createRef());
    }

    public handleClick = (tab: Tab, e: React.MouseEvent) => {
        e.preventDefault();
        this.props.updateTab(tab.name);
        (e.target as Element).closest('.settings-modal')?.classList.add('display--content');
    };

    public handleKeyUp = (index: number, e: React.KeyboardEvent) => {
        if (isKeyPressed(e, Constants.KeyCodes.UP)) {
            if (index > 0) {
                this.props.updateTab(this.props.tabs[index - 1].name);
                a11yFocus(this.buttonRefs[index - 1].current);
            }
        } else if (isKeyPressed(e, Constants.KeyCodes.DOWN)) {
            if (index < this.props.tabs.length - 1) {
                this.props.updateTab(this.props.tabs[index + 1].name);
                a11yFocus(this.buttonRefs[index + 1].current);
            }
        }
    };

    private renderTab(tab: Tab, index: number) {
        const key = `${tab.name}_li`;
        const isActive = this.props.activeTab === tab.name;
        let className = '';
        if (isActive) {
            className = 'active';
        }

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
            <li
                id={`${tab.name}Li`}
                key={key}
                className={className}
                role='presentation'
            >
                <button
                    ref={this.buttonRefs[index]}
                    id={`${tab.name}Button`}
                    className='cursor--pointer style--none'
                    onClick={this.handleClick.bind(null, tab)}
                    onKeyUp={this.handleKeyUp.bind(null, index)}
                    aria-label={tab.uiName.toLowerCase()}
                    role='tab'
                    aria-selected={isActive}
                    tabIndex={!isActive && !this.props.isMobileView ? -1 : 0}
                >
                    {icon}
                    {tab.uiName}
                </button>
            </li>
        );
    }

    public render() {
        const tabList = this.props.tabs.map((tab, index) => this.renderTab(tab, index));
        let pluginTabList: React.ReactNode;
        if (this.props.pluginTabs?.length) {
            pluginTabList = (
                <>
                    <hr/>
                    <li
                        key={'plugin preferences heading'}
                        role='heading'
                        className={'header'}
                    >
                        <FormattedMessage
                            id={'userSettingsModal.pluginPreferences.header'}
                            defaultMessage={'PLUGIN PREFERENCES'}
                        />
                    </li>
                    {this.props.pluginTabs.map((tab, index) => this.renderTab(tab, index))}
                </>
            );
        }

        return (
            <div>
                <ul
                    id='tabList'
                    className='nav nav-pills nav-stacked'
                    role='tablist'
                    aria-orientation='vertical'
                >
                    {tabList}
                    {pluginTabList}
                </ul>
            </div>
        );
    }
}
