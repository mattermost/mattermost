// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

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
    test('should call onClose when clicking on the close icon', () => {
        const onClose = jest.fn();

        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByLabelText('Close Sidebar Icon'));

        expect(onClose).toHaveBeenCalled();
    });
    test('should call onClose when clicking on the back icon', () => {
        const onClose = jest.fn();

        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={true}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByLabelText('Back Icon'));

        expect(onClose).toHaveBeenCalled();
    });
});
