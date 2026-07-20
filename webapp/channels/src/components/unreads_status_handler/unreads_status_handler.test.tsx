// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {isChrome, isFirefox} from '@mattermost/shared/utils/user_agent';
import type {ChannelType} from '@mattermost/types/channels';
import type {TeamType} from '@mattermost/types/teams';

import UnreadsStatusHandler, {UnreadsStatusHandlerClass} from 'components/unreads_status_handler/unreads_status_handler';

import {renderWithContext} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

type Props = ComponentProps<typeof UnreadsStatusHandlerClass>;

jest.mock('@mattermost/shared/utils/user_agent', () => {
    const original = jest.requireActual('@mattermost/shared/utils/user_agent');
    return {
        ...original,
        isFirefox: jest.fn().mockReturnValue(true),
        isChrome: jest.fn(),
    };
});

describe('components/UnreadsStatusHandler', () => {
    const defaultProps = {
        unreadStatus: false,
        siteName: 'Test site',
        currentChannel: TestHelper.getChannelMock({
            id: 'c1',
            display_name: 'Public test 1',
            name: 'public-test-1',
            type: Constants.OPEN_CHANNEL as ChannelType,
        }),
        currentTeam: TestHelper.getTeamMock({
            id: 'team_id',
            name: 'test-team',
            display_name: 'Test team display name',
            description: 'Test team description',
            type: 'team-type' as TeamType,
        }),
        currentTeammate: null,
        inGlobalThreads: false,
        inDrafts: false,
        inScheduledPosts: false,
    };

    test('set correctly the title when needed', () => {
        // Render with slightly different prop to trigger componentDidUpdate on first rerender
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={true}
            />,
        );

        // Track cumulative props like Enzyme's setProps
        let currentProps: any = {...defaultProps};

        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('Public test 1 - Test team display name Test site');

        currentProps = {...currentProps, siteName: undefined};
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('Public test 1 - Test team display name');

        currentProps = {
            ...currentProps,
            currentChannel: {id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel'],
            currentTeammate: {display_name: 'teammate'} as Props['currentTeammate'],
        };
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('teammate - Test team display name');

        currentProps = {...currentProps, unreadStatus: 3};
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('(3) teammate - Test team display name');

        currentProps = {
            ...currentProps,
            currentChannel: {} as Props['currentChannel'],
            currentTeammate: {} as Props['currentTeammate'],
        };
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('Mattermost - Join a team');

        currentProps = {
            ...currentProps,
            inDrafts: false,
            inScheduledPosts: true,
            unreadStatus: 0,
        };
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('Scheduled - Test team display name');

        currentProps = {
            ...currentProps,
            inDrafts: false,
            inScheduledPosts: true,
            unreadStatus: 10,
        };
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('(10) Scheduled - Test team display name');

        currentProps = {
            ...currentProps,
            inDrafts: true,
            inScheduledPosts: false,
            unreadStatus: 0,
        };
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('Drafts - Test team display name');

        currentProps = {
            ...currentProps,
            inDrafts: true,
            inScheduledPosts: false,
            unreadStatus: 10,
        };
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('(10) Drafts - Test team display name');
    });

    test('should set correct title on mentions on safari', () => {
        // in safari browser, modification of favicon is not
        // supported, hence we need to show * in title on mentions
        (isFirefox as jest.Mock).mockImplementation(() => false);
        (isChrome as jest.Mock).mockImplementation(() => false);

        const {rerender} = renderWithContext(
            <UnreadsStatusHandler {...defaultProps}/>,
        );

        let currentProps: any = {...defaultProps, siteName: undefined};
        currentProps = {
            ...currentProps,
            currentChannel: {id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel'],
            currentTeammate: {display_name: 'teammate'} as Props['currentTeammate'],
        };
        currentProps = {...currentProps, unreadStatus: 3};
        rerender(<UnreadsStatusHandler {...currentProps}/>);
        expect(document.title).toBe('(3) * teammate - Test team display name');
    });

    test('should display correct favicon', () => {
        const sizes = ['16x16', '24x24', '32x32', '64x64', '96x96'];
        sizes.forEach((size) => {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.setAttribute('sizes', size);
            document.head.appendChild(link);
        });

        (isFirefox as jest.Mock).mockReturnValue(true);

        // Spy on getBadgeStatus to verify the correct badge status is computed
        // (updateFavicon is an arrow function so we can't spy on it directly)
        const getBadgeStatusSpy = jest.spyOn(UnreadsStatusHandlerClass.prototype, 'getBadgeStatus');

        const {rerender} = renderWithContext(
            <UnreadsStatusHandler {...defaultProps}/>,
        );

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={3}
            />,
        );
        expect(getBadgeStatusSpy).toHaveLastReturnedWith('Mention');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={true}
            />,
        );
        expect(getBadgeStatusSpy).toHaveLastReturnedWith('Unread');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={false}
            />,
        );
        expect(getBadgeStatusSpy).toHaveLastReturnedWith('None');

        getBadgeStatusSpy.mockRestore();

        // Clean up
        sizes.forEach((size) => {
            const link = document.querySelector(`link[rel="icon"][sizes="${size}"]`);
            if (link) {
                link.remove();
            }
        });
    });

    test('should display correct title when in drafts', () => {
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler {...defaultProps}/>,
        );

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                inDrafts={true}
                currentChannel={undefined}
                siteName={undefined}
            />,
        );

        expect(document.title).toBe('Drafts - Test team display name');
    });

    test('should display correct title when in scheduled posts tab', () => {
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler {...defaultProps}/>,
        );

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                inScheduledPosts={true}
                currentChannel={undefined}
                siteName={undefined}
            />,
        );

        expect(document.title).toBe('Scheduled - Test team display name');
    });
});
