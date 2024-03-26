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

describe('properly use the correct icon', () => {
    it('icon as a string', () => {
        const iconTitle = 'Icon title';
        const icon = 'icon';
        const props: Props = {
            ...baseProps,
            tabs: [{
                icon,
                iconTitle,
                name: 'tab',
                uiName: 'Tab UI Name',
            }],
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
            pluginTabs: [{
                icon: {url},
                iconTitle,
                name: 'tab',
                uiName: 'Tab UI Name',
            }],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        const element = screen.queryByAltText(iconTitle);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('IMG');
        expect(element!.getAttribute('src')).toBe(url);
    });
});

describe('show PLUGIN PREFERENCES only when plugin tabs are added', () => {
    it('not show when there are no plugin tabs', () => {
        const props: Props = {
            ...baseProps,
            tabs: [{
                icon: 'icon',
                iconTitle: 'title',
                name: 'tab',
                uiName: 'Tab UI Name',
            }],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.queryByText('PLUGIN PREFERENCES')).not.toBeInTheDocument();
    });

    it('show when there are plugin tabs', () => {
        const props: Props = {
            ...baseProps,
            pluginTabs: [{
                icon: 'icon',
                iconTitle: 'title',
                name: 'tab',
                uiName: 'Tab UI Name',
            }],
        };
        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.queryByText('PLUGIN PREFERENCES')).toBeInTheDocument();
    });
});

describe('tabs are properly rendered', () => {
    it('plugin tabs are properly rendered', () => {
        const uiName1 = 'Tab UI Name 1';
        const uiName2 = 'Tab UI Name 2';
        const props: Props = {
            ...baseProps,
            pluginTabs: [
                {
                    icon: 'icon1',
                    iconTitle: 'title1',
                    name: 'tab1',
                    uiName: uiName1,
                },
                {
                    icon: 'icon2',
                    iconTitle: 'title2',
                    name: 'tab2',
                    uiName: uiName2,
                },
            ],
        };

        renderWithContext(<SettingsSidebar {...props}/>);

        expect(screen.queryByText(uiName1)).toBeInTheDocument();
        expect(screen.queryByText(uiName2)).toBeInTheDocument();
    });
});
