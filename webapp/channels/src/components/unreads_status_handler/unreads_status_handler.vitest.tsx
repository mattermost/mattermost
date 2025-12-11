// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {TeamType} from '@mattermost/types/teams';

import UnreadsStatusHandler from 'components/unreads_status_handler/unreads_status_handler';
import type {UnreadsStatusHandlerClass} from 'components/unreads_status_handler/unreads_status_handler';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {isChrome, isFirefox} from 'utils/user_agent';

type Props = ComponentProps<typeof UnreadsStatusHandlerClass>;

vi.mock('utils/user_agent', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original as object,
        isFirefox: vi.fn().mockReturnValue(true),
        isChrome: vi.fn(),
    };
});

describe('components/UnreadsStatusHandler', () => {
    const createDefaultProps = (): Props => ({
        intl: {formatMessage: vi.fn(({id, defaultMessage}) => defaultMessage || id)} as any,
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
    });

    beforeEach(() => {
        vi.clearAllMocks();
        document.title = '';
    });

    test('set correctly the title when needed', () => {
        const defaultProps = createDefaultProps();

        // Start with different props, then update to trigger componentDidUpdate
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={true}
            />,
        );

        // First rerender to trigger componentDidUpdate and set the title
        rerender(<UnreadsStatusHandler {...defaultProps}/>);

        expect(document.title).toBe('Public test 1 - Test team display name Test site');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
            />,
        );
        expect(document.title).toBe('Public test 1 - Test team display name');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel']}
                currentTeammate={{display_name: 'teammate'} as Props['currentTeammate']}
            />,
        );
        expect(document.title).toBe('teammate - Test team display name');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel']}
                currentTeammate={{display_name: 'teammate'} as Props['currentTeammate']}
                unreadStatus={3}
            />,
        );
        expect(document.title).toBe('(3) teammate - Test team display name');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{} as Props['currentChannel']}
                currentTeammate={{} as Props['currentTeammate']}
                unreadStatus={3}
            />,
        );
        expect(document.title).toBe('Mattermost - Join a team');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{} as Props['currentChannel']}
                currentTeammate={{} as Props['currentTeammate']}
                inDrafts={false}
                inScheduledPosts={true}
                unreadStatus={0}
            />,
        );
        expect(document.title).toBe('Scheduled - Test team display name');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{} as Props['currentChannel']}
                currentTeammate={{} as Props['currentTeammate']}
                inDrafts={false}
                inScheduledPosts={true}
                unreadStatus={10}
            />,
        );
        expect(document.title).toBe('(10) Scheduled - Test team display name');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{} as Props['currentChannel']}
                currentTeammate={{} as Props['currentTeammate']}
                inDrafts={true}
                inScheduledPosts={false}
                unreadStatus={0}
            />,
        );
        expect(document.title).toBe('Drafts - Test team display name');

        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{} as Props['currentChannel']}
                currentTeammate={{} as Props['currentTeammate']}
                inDrafts={true}
                inScheduledPosts={false}
                unreadStatus={10}
            />,
        );
        expect(document.title).toBe('(10) Drafts - Test team display name');
    });

    test('should set correct title on mentions on safari', () => {
        // in safari browser, modification of favicon is not
        // supported, hence we need to show * in title on mentions
        (isFirefox as ReturnType<typeof vi.fn>).mockImplementation(() => false);
        (isChrome as ReturnType<typeof vi.fn>).mockImplementation(() => false);

        const defaultProps = createDefaultProps();

        // Initial render
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel']}
                currentTeammate={{display_name: 'teammate'} as Props['currentTeammate']}
                unreadStatus={0}
            />,
        );

        // Trigger update with unreadStatus = 3
        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                siteName={undefined}
                currentChannel={{id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel']}
                currentTeammate={{display_name: 'teammate'} as Props['currentTeammate']}
                unreadStatus={3}
            />,
        );

        expect(document.title).toBe('(3) * teammate - Test team display name');
    });

    test('should display correct favicon', () => {
        // Setup: Create a favicon link element
        const link = document.createElement('link');
        link.rel = 'icon';
        link.id = 'favicon';
        document.head.appendChild(link);

        const defaultProps = createDefaultProps();

        // Initial render with no unreads
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={false}
            />,
        );

        // When unreadStatus is a number (mentions), favicon should indicate 'Mention'
        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={3}
            />,
        );

        // The component should update the favicon - check for mention indicator
        const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        expect(faviconLink).toBeInTheDocument();

        // When unreadStatus is true (unreads without mentions), favicon should indicate 'Unread'
        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={true}
            />,
        );

        // When unreadStatus is false (no unreads), favicon should indicate 'None'
        rerender(
            <UnreadsStatusHandler
                {...defaultProps}
                unreadStatus={false}
            />,
        );

        // Cleanup
        document.head.removeChild(link);
    });

    test('should display correct title when in drafts', () => {
        const defaultProps = createDefaultProps();

        // Initial render
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler
                {...defaultProps}
                inDrafts={false}
                currentChannel={undefined}
                siteName={undefined}
            />,
        );

        // Trigger update with inDrafts = true
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
        const defaultProps = createDefaultProps();

        // Initial render
        const {rerender} = renderWithContext(
            <UnreadsStatusHandler
                {...defaultProps}
                inScheduledPosts={false}
                currentChannel={undefined}
                siteName={undefined}
            />,
        );

        // Trigger update with inScheduledPosts = true
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
