// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import Header from './header';

describe('channel_info_rhs/header', () => {
    test('should the current channel name', () => {
        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                isArchived={false}
                onClose={() => {}}
            />,
        );

        expect(screen.getByText('my channel title')).toBeInTheDocument();
    });
    test('should call onClose when clicking on the close icon', () => {
        const onClose = jest.fn();

        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                isArchived={false}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByLabelText('Close Sidebar Icon', {selector: 'button.sidebar--right__close'}));

        expect(onClose).toHaveBeenCalled();
    });
    test('should call onClose when clicking on the back icon', () => {
        const onClose = jest.fn();

        renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={true}
                isArchived={false}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByLabelText('Back Icon'));

        expect(onClose).toHaveBeenCalled();
    });
    test('should have archived icon when channel is archived', () => {
        const {container} = renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                isArchived={true}
                onClose={() => {}}
            />,
        );

        expect(container.querySelector('i.icon-archive-outline')).toBeInTheDocument();
    });
    test('should not have archived icon when channel is archived', () => {
        const {container} = renderWithContext(
            <Header
                channel={{display_name: 'my channel title'} as Channel}
                isMobile={false}
                isArchived={false}
                onClose={() => {}}
            />,
        );

        expect(container.querySelector('i.icon-archive-outline')).not.toBeInTheDocument();
    });
});
