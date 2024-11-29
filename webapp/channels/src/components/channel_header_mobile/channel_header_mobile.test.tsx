// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithIntl} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderMobile from './channel_header_mobile';

describe('components/ChannelHeaderMobile/ChannelHeaderMobile', () => {
    global.document.querySelector = jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    });

    const baseProps = {
        user: TestHelper.getUserMock({
            id: 'user_id',
        }),
        channel: TestHelper.getChannelMock({
            type: 'O',
            id: 'channel_id',
            display_name: 'display_name',
            team_id: 'team_id',
        }),
        member: TestHelper.getChannelMembershipMock({
            channel_id: 'channel_id',
            user_id: 'user_id',
        }),
        teamDisplayName: 'team_display_name',
        isPinnedPosts: true,
        actions: {
            closeLhs: jest.fn(),
            closeRhs: jest.fn(),
            closeRhsMenu: jest.fn(),
        },
        isLicensed: true,
        isMobileView: false,
        isFavoriteChannel: false,
    };

    test('should render channel header mobile component', () => {
        renderWithIntl(<ChannelHeaderMobile {...baseProps}/>);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Toggle sidebar Menu Icon'})).toBeInTheDocument();
    });

    test('should render default channel header', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'O',
                id: '123',
                name: 'town-square',
                display_name: 'Town Square',
                team_id: 'team_id',
            }),
        };
        renderWithIntl(<ChannelHeaderMobile {...props}/>);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const heading = screen.getByRole('navigation').querySelector('.navbar-brand');
        expect(heading).not.toBeNull();
        expect(heading).toBeInTheDocument();
        expect(heading?.textContent).toMatch(/Town Square/i);
    });

    test('should render DM channel header', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'D',
                id: 'channel_id',
                name: 'user_id_1__user_id_2',
                display_name: 'display_name',
                team_id: 'team_id',
            }),
        };
        renderWithIntl(<ChannelHeaderMobile {...props}/>);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const heading = screen.getByRole('navigation').querySelector('.navbar-brand');
        expect(heading).not.toBeNull();
        expect(heading).toBeInTheDocument();
        expect(heading?.textContent).toMatch(/display_name/i);
    });

    test('should render private channel header', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'P',
                id: 'channel_id',
                display_name: 'display_name',
                team_id: 'team_id',
            }),
        };
        renderWithIntl(<ChannelHeaderMobile {...props}/>);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const heading = screen.getByRole('navigation').querySelector('.navbar-brand');
        expect(heading).not.toBeNull();
        expect(heading).toBeInTheDocument();
        expect(heading?.textContent).toMatch(/display_name/i);
    });
});
