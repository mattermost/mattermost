// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import SettingsSidebar from './settings_sidebar';

type Props = ComponentProps<typeof SettingsSidebar>;

const baseProps: Props = {
    isMobileView: false,
    tabs: [],
    updateTab: jest.fn(),
    pluginTabs: [],
};

const makeTab = (overrides: Partial<Props['tabs'][number]> = {}) => ({
    icon: 'icon',
    iconTitle: 'Icon title',
    name: 'tab',
    uiName: 'Tab UI Name',
    ...overrides,
});

describe('properly use the correct icon', () => {
    it('icon as a string', () => {
        const iconTitle = 'Icon title';
        const icon = 'icon';
        const props: Props = {
            ...baseProps,
            tabs: [makeTab({icon, iconTitle})],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        const element = screen.queryByTitle(iconTitle);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('I');
        expect(element!.className).toBe(icon);
    });

    it('icon as an image', () => {
        const iconTitle = 'Icon title';
        const url = 'icon_url';
        const props: Props = {
            ...baseProps,
            pluginTabs: [makeTab({icon: {url}, iconTitle})],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        const element = screen.queryByAltText(iconTitle);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('IMG');
        expect(element!.getAttribute('src')).toBe(url);
    });
});

describe('plugin section heading', () => {
    it('does not render the default plugin section heading when there are no plugin tabs', () => {
        const props: Props = {
            ...baseProps,
            tabs: [makeTab()],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.queryByText('PLUGIN PREFERENCES')).not.toBeInTheDocument();
    });

    it('renders the default plugin section heading when plugin tabs exist and no override label is provided', () => {
        const props: Props = {
            ...baseProps,
            pluginTabs: [makeTab()],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.getByRole('heading', {name: 'PLUGIN PREFERENCES'})).toBeInTheDocument();
    });

    it('renders a custom plugin section heading when pluginSectionLabel is provided', () => {
        const props: Props = {
            ...baseProps,
            pluginTabs: [makeTab()],
            pluginSectionLabel: 'PLUGIN SETTINGS',
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.getByRole('heading', {name: 'PLUGIN SETTINGS'})).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: 'PLUGIN PREFERENCES'})).not.toBeInTheDocument();
    });

    it('uses the provided pluginSectionHeadingId for the plugin group labelling', () => {
        const props: Props = {
            ...baseProps,
            pluginTabs: [makeTab()],
            pluginSectionLabel: 'Custom Plugin Settings',
            pluginSectionHeadingId: 'custom_plugin_section_heading',
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        const heading = screen.getByRole('heading', {name: 'Custom Plugin Settings'});
        const group = screen.getByRole('group', {name: 'Custom Plugin Settings'});

        expect(heading).toHaveAttribute('id', 'custom_plugin_section_heading');
        expect(group).toHaveAttribute('aria-labelledby', 'custom_plugin_section_heading');
    });
});

describe('tabs are properly rendered', () => {
    it('plugin tabs are properly rendered', () => {
        const uiName1 = 'Tab UI Name 1';
        const uiName2 = 'Tab UI Name 2';
        const props: Props = {
            ...baseProps,
            pluginTabs: [
                makeTab({icon: 'icon1', iconTitle: 'title1', name: 'tab1', uiName: uiName1}),
                makeTab({icon: 'icon2', iconTitle: 'title2', name: 'tab2', uiName: uiName2}),
            ],
        };

        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.queryByText(uiName1)).toBeInTheDocument();
        expect(screen.queryByText(uiName2)).toBeInTheDocument();
    });

    it('renders built-in tabs before the plugin section and plugin tabs', () => {
        const props: Props = {
            ...baseProps,
            tabs: [
                makeTab({name: 'built-in-1', uiName: 'Built In One'}),
                makeTab({name: 'built-in-2', uiName: 'Built In Two'}),
            ],
            pluginTabs: [
                makeTab({name: 'plugin-1', uiName: 'Plugin Tab'}),
            ],
            pluginSectionLabel: 'Custom Plugin Settings',
        };

        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
            'Built In One',
            'Built In Two',
            'Plugin Tab',
        ]);

        const builtInTab = screen.getByRole('tab', {name: /built in two/i});
        const heading = screen.getByRole('heading', {name: 'Custom Plugin Settings'});
        const pluginTab = screen.getByRole('tab', {name: /plugin tab/i});

        expect(Boolean(builtInTab.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        expect(Boolean(heading.compareDocumentPosition(pluginTab) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });

    it('renders exactly one plugin-section divider when tabs have no built-in group break', () => {
        const props: Props = {
            ...baseProps,
            tabs: [makeTab({name: 'built-in-1', uiName: 'Built In One'})],
            pluginTabs: [makeTab({name: 'plugin-1', uiName: 'Plugin Tab'})],
        };

        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.getAllByRole('separator')).toHaveLength(1);
    });
});
