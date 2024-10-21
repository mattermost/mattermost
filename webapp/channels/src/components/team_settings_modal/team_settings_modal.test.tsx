// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import TeamSettingsModal from 'components/team_settings_modal/team_settings_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/team_settings_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        canInviteUsers: true,
    };

    test('should hide the modal when the close button is clicked', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
        );
        const modal = screen.getByRole('dialog', {name: 'Close Team Settings'});
        expect(modal.className).toBe('fade in modal');
        fireEvent.click(screen.getByText('Close'));
        expect(modal.className).toBe('fade modal');
    });

    test('should display access tab when can invite users', async () => {
        const props = {...baseProps, canInviteUsers: true};
        renderWithContext(
            <TeamSettingsModal
                {...props}
            />,
        );
        const infoButton = screen.getByRole('tab', {name: 'info'});
        expect(infoButton).toBeDefined();
        const accessButton = screen.getByRole('tab', {name: 'access'});
        expect(accessButton).toBeDefined();
    });

    test('should not display access tab when can not invite users', async () => {
        const props = {...baseProps, canInviteUsers: false};
        renderWithContext(
            <TeamSettingsModal
                {...props}
            />,
        );
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toEqual(1);
        const infoButton = screen.getByRole('tab', {name: 'info'});
        expect(infoButton).toBeDefined();
    });
});

