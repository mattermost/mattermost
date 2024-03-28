// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import UserSettingsModal from 'components/user_settings_modal/user_settings_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/user_settings_modal', () => {
    const baseProps = {
        isCloud: false,
        onExited: jest.fn(),
    };

    test('should hide the modal when the close button is clicked', async () => {
        renderWithContext(
            <UserSettingsModal
                {...baseProps}
            />,
        );
        const modal = screen.getByRole('dialog', {name: 'Close User Settings'});
        expect(modal.className).toBe('fade in modal');
        fireEvent.click(screen.getByText('Close'));
        expect(modal.className).toBe('fade modal');
    });
});

