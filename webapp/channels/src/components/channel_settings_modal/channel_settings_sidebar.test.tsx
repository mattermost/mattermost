// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelSettingsSidebar from './channel_settings_sidebar';

describe('ChannelSettingsSidebar', () => {
    const tabs = [
        {id: 'info', label: 'Info'},
        {id: 'configuration', label: 'Configuration'},
        {id: 'archive', label: 'Archive Channel'},
    ];
    const setActiveTab = jest.fn();

    const baseProps = {
        tabs,
        activeTab: 'info',
        setActiveTab,
    };

    beforeEach(() => {
        setActiveTab.mockClear();
    });

    it('should render all tabs', () => {
        renderWithContext(<ChannelSettingsSidebar {...baseProps}/>);
        tabs.forEach((tab) => {
            expect(screen.getByRole('button', {name: tab.label})).toBeInTheDocument();
        });
    });

    it('should mark the active tab with aria-current and active class', () => {
        renderWithContext(<ChannelSettingsSidebar {...baseProps}/>);
        const activeButton = screen.getByRole('button', {name: 'Info'});
        expect(activeButton.getAttribute('aria-current')).toBe('page');

        // Check that its parent <li> has the 'active' class.
        expect(activeButton.closest('li')?.className).toMatch(/active/);
    });

    it('should call setActiveTab with the correct id when a tab is clicked', async () => {
        renderWithContext(<ChannelSettingsSidebar {...baseProps}/>);
        const configButton = screen.getByRole('button', {name: 'Configuration'});
        await userEvent.click(configButton);
        expect(setActiveTab).toHaveBeenCalledWith('configuration');
    });
});
