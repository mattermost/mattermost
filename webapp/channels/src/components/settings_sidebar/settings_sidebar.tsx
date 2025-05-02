// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

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
    buttonRefs: Map<string, RefObject<HTMLButtonElement>>;

    constructor(props: Props) {
        super(props);

        // Initialize an empty Map for button refs
        this.buttonRefs = new Map();

        // Initialize refs for all tabs
        this.initializeButtonRefs(props.tabs, props.pluginTabs);
    }

    // Initialize or update button refs for all tabs
    private initializeButtonRefs(tabs: Tab[], pluginTabs?: Tab[]) {
        // Clear existing refs if reinitializing
        this.buttonRefs.clear();

        // Create refs for all tabs, regardless of display status
        tabs.forEach((tab) => {
            this.buttonRefs.set(tab.name, React.createRef());
        });

        // Create refs for plugin tabs if they exist
        if (pluginTabs?.length) {
            pluginTabs.forEach((tab) => {
                this.buttonRefs.set(tab.name, React.createRef());
            });
        }
    }

    // Update refs when props change
    componentDidUpdate(prevProps: Props) {
        // Check if tabs or pluginTabs have changed
        if (prevProps.tabs !== this.props.tabs || prevProps.pluginTabs !== this.props.pluginTabs) {
            this.initializeButtonRefs(this.props.tabs, this.props.pluginTabs);
        }
    }

    // Get all visible tabs in the correct order
    private getVisibleTabs(): Tab[] {
        const visibleTabs = this.props.tabs.filter((tab) => tab.display !== false);
        const visiblePluginTabs = this.props.pluginTabs?.filter((tab) => tab.display !== false) || [];
        return [...visibleTabs, ...visiblePluginTabs];
    }

    public handleClick = (tab: Tab, e: React.MouseEvent) => {
        e.preventDefault();
        this.props.updateTab(tab.name);
        (e.target as Element).closest('.settings-modal')?.classList.add('display--content');
    };

    public handleKeyUp = (tab: Tab, e: React.KeyboardEvent) => {
        // Only handle UP and DOWN arrow keys
        if (!isKeyPressed(e, Constants.KeyCodes.UP) && !isKeyPressed(e, Constants.KeyCodes.DOWN)) {
            return;
        }

        // Prevent default behavior
        e.preventDefault();

        // Get all visible tabs
        const visibleTabs = this.getVisibleTabs();

        // If no tabs are visible, do nothing
        if (visibleTabs.length === 0) {
            return;
        }

        // Find the current tab's position in the visible tabs
        const currentIndex = visibleTabs.findIndex((t) => t.name === tab.name);

        // If tab not found in visible tabs, do nothing
        if (currentIndex === -1) {
            return;
        }

        let nextIndex: number;

        // Determine which tab to focus based on the key pressed
        if (isKeyPressed(e, Constants.KeyCodes.UP)) {
            // UP arrow key - move to previous tab or wrap to last
            nextIndex = currentIndex > 0 ? currentIndex - 1 : visibleTabs.length - 1;
        } else {
            // DOWN arrow key - move to next tab or wrap to first
            nextIndex = currentIndex < visibleTabs.length - 1 ? currentIndex + 1 : 0;
        }

        // Get the target tab
        const targetTab = visibleTabs[nextIndex];

        // Update the active tab
        this.props.updateTab(targetTab.name);

        // Focus the target tab button directly
        const targetButton = this.buttonRefs.get(targetTab.name)?.current;
        if (targetButton) {
            // Use direct focus instead of a11yFocus to ensure Cypress tests can detect the focus change
            targetButton.focus();
        }
    };

    private renderTab(tab: Tab) {
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
                    data-testid={`${tab.name}-tab-button`}
                    ref={this.buttonRefs.get(tab.name)}
                    id={`${tab.name}Button`}
                    className={classNames('cursor--pointer style--none nav-pills__tab', {active: isActive})}
                    onClick={this.handleClick.bind(null, tab)}
                    onKeyUp={this.handleKeyUp.bind(null, tab)}
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
        // Filter regular tabs and plugin tabs separately for rendering
        const visibleTabs = this.props.tabs.filter((tab) => tab.display !== false);

        // Map regular tabs
        const tabList = visibleTabs.map((tab) => this.renderTab(tab));

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
                            {visiblePluginTabs.map((tab) => this.renderTab(tab))}
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
