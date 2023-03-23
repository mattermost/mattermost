// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {RefObject} from 'react';

import * as UserAgent from 'utils/user_agent';
import Constants from 'utils/constants';
import {a11yFocus, isKeyPressed} from 'utils/utils';

export type Tab = {
    icon: string;
    iconTitle: string;
    name: string;
    uiName: string;
}

export type Props = {
    activeTab?: string;
    tabs: Tab[];
    updateTab: (name: string) => void;
    isMobileView: boolean;
}

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
    }

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
    }

    public componentDidMount() {
        if (UserAgent.isFirefox()) {
            document.querySelector('.settings-modal .settings-table .nav')?.classList.add('position--top');
        }
    }

    public render() {
        const tabList = this.props.tabs.map((tab, index) => {
            const key = `${tab.name}_li`;
            const isActive = this.props.activeTab === tab.name;
            let className = '';
            if (isActive) {
                className = 'active';
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
                        <i
                            className={tab.icon}
                            title={tab.iconTitle}
                        />
                        {tab.uiName}
                    </button>
                </li>
            );
        });

        return (
            <div>
                <ul
                    id='tabList'
                    className='nav nav-pills nav-stacked'
                    role='tablist'
                    aria-orientation='vertical'
                >
                    {tabList}
                </ul>
            </div>
        );
    }
}
