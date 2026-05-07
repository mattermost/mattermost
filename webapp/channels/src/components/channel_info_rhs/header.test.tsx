// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Header from './header';

describe('channel_info_rhs/header', () => {
    test('renders the header title', () => {
        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                onClose={() => {}}
            />,
        );

        expect(screen.getByText('Info')).toBeInTheDocument();
        expect(screen.getByText('my channel title')).toBeInTheDocument();
    });
    test('should call onClose when clicking on the close icon', async () => {
        const onClose = jest.fn();

        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                onClose={onClose}
            />,
        );

        await userEvent.click(screen.getByLabelText('Close Sidebar Icon'));

        expect(onClose).toHaveBeenCalled();
    });
    test('should call onClose when clicking on the back icon', async () => {
        const onClose = jest.fn();

        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={true}
                onClose={onClose}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));

        expect(onClose).toHaveBeenCalled();
    });
});
