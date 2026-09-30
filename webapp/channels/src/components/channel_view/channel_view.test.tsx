// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {markChannelAsRead} from 'mattermost-redux/actions/channels';

import {clearLoggedChannelViewErrors} from 'selectors/channel_view_plugin';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ChannelViewPluginComponentProps, ChannelViewRegistration} from 'types/store/plugins';

import ChannelView from './channel_view';
import type {Props} from './channel_view';

import ConnectedChannelView from './index';

jest.mock('components/async_load', () => ({
    makeAsyncComponent: (name: string) => {
        const Component = () => <div data-testid={name}/>;
        Component.displayName = name;
        return Component;
    },
}));

jest.mock('components/deferComponentRender', () => {
    return jest.fn(() => {
        return function DeferredPostView(props: any) {
            return (
                <div
                    data-testid='deferred-post-view'
                    {...(props.focusedPostId ? {'data-focused-post-id': props.focusedPostId} : {})}
                    data-channel-id={props.channelId}
                />
            );
        };
    });
});

jest.mock('components/post_view', () => () => <div data-testid='post-view'/>);

jest.mock('components/channel_header', () => () => <div data-testid='channel-header'/>);

jest.mock('components/advanced_create_post', () => () => <div data-testid='advanced-create-post'/>);

jest.mock('client/web_websocket_client', () => ({
    __esModule: true,
    default: {updateActiveChannel: jest.fn()},
}));

jest.mock('./input_loading', () => () => <div data-testid='input-loading'/>);

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    markChannelAsRead: jest.fn((channelId: string) => ({type: 'MOCK_MARK_CHANNEL_AS_READ', channelId})),
}));

beforeEach(() => {
    jest.mocked(markChannelAsRead).mockClear();
});

describe('components/channel_view', () => {
    const baseProps: Props = {
        channelId: 'channelId',
        deactivatedChannel: false,
        history: {} as Props['history'],
        location: {} as Props['location'],
        match: {
            url: '/team/channel/channelId',
            params: {},
        } as Props['match'],
        enableOnboardingFlow: true,
        teamUrl: '/team',
        channelIsArchived: false,
        isCloud: false,
        goToLastViewedChannel: jest.fn(),
        isFirstAdmin: false,
        isChannelBookmarksEnabled: false,
        missingChannelRole: false,
        fetchIsRestrictedDM: jest.fn(),
        canRestrictDirectMessage: false,
        restrictDirectMessage: false,
        channelViewPluginComponent: null,
    };

    it('Should match snapshot with base props', () => {
        const {container} = renderWithContext(<ChannelView {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('Should match snapshot if channel is archived', () => {
        const {container} = renderWithContext(
            <ChannelView
                {...baseProps}
                channelIsArchived={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('Should match snapshot if channel is deactivated', () => {
        const {container} = renderWithContext(
            <ChannelView
                {...baseProps}
                deactivatedChannel={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('Should have focusedPostId state based on props', () => {
        const {rerender} = renderWithContext(<ChannelView {...baseProps}/>);

        // Initially no focusedPostId
        expect(screen.getByTestId('deferred-post-view')).not.toHaveAttribute('data-focused-post-id');

        // Rerender with postid
        rerender(
            <ChannelView
                {...baseProps}
                channelId='newChannelId'
                match={{url: '/team/channel/channelId/postId', params: {postid: 'postid'}} as Props['match']}
            />,
        );
        expect(screen.getByTestId('deferred-post-view')).toHaveAttribute('data-focused-post-id', 'postid');

        // Rerender with different postid
        rerender(
            <ChannelView
                {...baseProps}
                channelId='newChannelId'
                match={{url: '/team/channel/channelId/postId1', params: {postid: 'postid1'}} as Props['match']}
            />,
        );
        expect(screen.getByTestId('deferred-post-view')).toHaveAttribute('data-focused-post-id', 'postid1');
    });

    it('should call fetchRecentMentions on componentDidUpdate', () => {
        const {rerender} = renderWithContext(
            <ChannelView
                {...baseProps}
                canRestrictDirectMessage={true}
                restrictDirectMessage={undefined as any}
            />,
        );
        rerender(
            <ChannelView
                {...baseProps}
                canRestrictDirectMessage={true}
                restrictDirectMessage={undefined as any}
                channelId='newChannelId'
            />,
        );
        expect(baseProps.fetchIsRestrictedDM).toHaveBeenCalledTimes(1);
    });

    describe('plugin channel view', () => {
        const channel = TestHelper.getChannelMock({id: 'channelId', team_id: 'teamId', display_name: 'Board channel'});

        const otherChannel = TestHelper.getChannelMock({id: 'otherChannelId', team_id: 'teamId'});

        function PluginView({channel: pluginChannel, channelId, teamId, focusedPostId}: ChannelViewPluginComponentProps) {
            return (
                <div
                    data-testid='plugin-channel-view'
                    data-channel-name={pluginChannel.display_name}
                    data-channel-id={channelId}
                    data-team-id={teamId}
                    {...(focusedPostId ? {'data-focused-post-id': focusedPostId} : {})}
                />
            );
        }

        const registration: ChannelViewRegistration = {
            id: 'channel-view-reg',
            pluginId: 'test-plugin',
            matcher: () => true,
            component: PluginView,
        };

        const state = {
            entities: {
                channels: {channels: {channelId: channel, otherChannelId: otherChannel}},
                teams: {currentTeamId: 'currentTeamId'},
            },
        };

        const permalinkMatch = {url: '/team/channels/channel/postid', params: {postid: 'postid'}} as Props['match'];

        it('marks the channel as read on mount and whenever the channel changes', () => {
            const {rerender} = renderWithContext(
                <ChannelView
                    {...baseProps}
                    channelViewPluginComponent={registration}
                />,
                state,
            );

            expect(markChannelAsRead).toHaveBeenCalledTimes(1);
            expect(markChannelAsRead).toHaveBeenLastCalledWith('channelId');

            rerender(
                <ChannelView
                    {...baseProps}
                    channelViewPluginComponent={registration}
                />,
            );
            expect(markChannelAsRead).toHaveBeenCalledTimes(1);

            rerender(
                <ChannelView
                    {...baseProps}
                    channelId='otherChannelId'
                    match={{url: '/team/channels/other', params: {}} as Props['match']}
                    channelViewPluginComponent={registration}
                />,
            );
            expect(screen.getByTestId('plugin-channel-view')).toHaveAttribute('data-channel-id', 'otherChannelId');
            expect(markChannelAsRead).toHaveBeenCalledTimes(2);
            expect(markChannelAsRead).toHaveBeenLastCalledWith('otherChannelId');
        });

        it('does not mark the channel as read itself when no plugin view is rendered', () => {
            renderWithContext(<ChannelView {...baseProps}/>, state);

            expect(screen.getByTestId('deferred-post-view')).toBeInTheDocument();
            expect(markChannelAsRead).not.toHaveBeenCalled();
        });

        it('renders the core post view for a permalink when the registration does not handle permalinks', () => {
            renderWithContext(
                <ChannelView
                    {...baseProps}
                    match={permalinkMatch}
                    channelViewPluginComponent={registration}
                />,
                state,
            );

            expect(screen.getByTestId('channel-header')).toBeInTheDocument();
            expect(screen.getByTestId('deferred-post-view')).toHaveAttribute('data-focused-post-id', 'postid');
            expect(screen.getByTestId('post-create')).toBeInTheDocument();
            expect(screen.queryByTestId('plugin-channel-view')).not.toBeInTheDocument();
            expect(markChannelAsRead).not.toHaveBeenCalled();
        });

        it('keeps the core post view after the permalink is dropped from the URL until the channel changes', () => {
            const {rerender} = renderWithContext(
                <ChannelView
                    {...baseProps}
                    match={permalinkMatch}
                    channelViewPluginComponent={registration}
                />,
                state,
            );

            rerender(
                <ChannelView
                    {...baseProps}
                    match={{url: '/team/channels/channel', params: {}} as Props['match']}
                    channelViewPluginComponent={registration}
                />,
            );
            expect(screen.getByTestId('deferred-post-view')).toBeInTheDocument();
            expect(screen.queryByTestId('plugin-channel-view')).not.toBeInTheDocument();

            rerender(
                <ChannelView
                    {...baseProps}
                    channelId='otherChannelId'
                    match={{url: '/team/channels/other', params: {}} as Props['match']}
                    channelViewPluginComponent={registration}
                />,
            );
            expect(screen.getByTestId('plugin-channel-view')).toBeInTheDocument();
            expect(screen.queryByTestId('deferred-post-view')).not.toBeInTheDocument();
        });

        it('renders the plugin component with focusedPostId for a permalink when the registration handles permalinks', () => {
            renderWithContext(
                <ChannelView
                    {...baseProps}
                    match={permalinkMatch}
                    channelViewPluginComponent={{...registration, handlesPermalinks: true}}
                />,
                state,
            );

            expect(screen.getByTestId('plugin-channel-view')).toHaveAttribute('data-focused-post-id', 'postid');
            expect(screen.queryByTestId('deferred-post-view')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-create')).not.toBeInTheDocument();
            expect(markChannelAsRead).toHaveBeenCalledWith('channelId');
        });

        it('does not pass focusedPostId to the plugin component outside of a permalink', () => {
            renderWithContext(
                <ChannelView
                    {...baseProps}
                    channelViewPluginComponent={{...registration, handlesPermalinks: true}}
                />,
                state,
            );

            expect(screen.getByTestId('plugin-channel-view')).not.toHaveAttribute('data-focused-post-id');
        });

        it('renders the plugin component instead of the post list and composer, keeping the header', () => {
            renderWithContext(
                <ChannelView
                    {...baseProps}
                    channelViewPluginComponent={registration}
                />,
                state,
            );

            expect(screen.getByTestId('channel-header')).toBeInTheDocument();
            const pluginView = screen.getByTestId('plugin-channel-view');
            expect(pluginView).toHaveAttribute('data-channel-name', 'Board channel');
            expect(pluginView).toHaveAttribute('data-channel-id', 'channelId');
            expect(pluginView).toHaveAttribute('data-team-id', 'currentTeamId');
            expect(document.getElementById('channelViewPluginComponent')).toHaveAttribute('data-plugin-id', 'test-plugin');
            expect(screen.queryByTestId('deferred-post-view')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-create')).not.toBeInTheDocument();
            expect(document.getElementById('post-create')).not.toBeInTheDocument();
        });

        it('does not render the archived channel notice when the plugin component is active', () => {
            renderWithContext(
                <ChannelView
                    {...baseProps}
                    channelIsArchived={true}
                    channelViewPluginComponent={registration}
                />,
                state,
            );

            expect(screen.getByTestId('plugin-channel-view')).toBeInTheDocument();
            expect(screen.queryByText(/archived channel/)).not.toBeInTheDocument();
            expect(document.getElementById('post-create')).not.toBeInTheDocument();
        });

        it('shows the plugin error fallback instead of crashing when the plugin component throws', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const Broken = () => {
                throw new Error('boom');
            };

            renderWithContext(
                <ChannelView
                    {...baseProps}
                    channelViewPluginComponent={{...registration, component: Broken}}
                />,
                state,
            );

            expect(screen.getByTestId('channel-header')).toBeInTheDocument();
            expect(screen.getByText('An error occurred in the test-plugin plugin.')).toBeInTheDocument();
            consoleSpy.mockRestore();
        });
    });
});

describe('components/channel_view connected', () => {
    const channel = TestHelper.getChannelMock({id: 'channelId', team_id: 'teamId', delete_at: 0});

    beforeEach(() => {
        clearLoggedChannelViewErrors();
    });

    function makeState(registrations: ChannelViewRegistration[]) {
        return {
            entities: {
                channels: {
                    currentChannelId: channel.id,
                    channels: {[channel.id]: channel},
                    myMembers: {[channel.id]: TestHelper.getChannelMembershipMock({channel_id: channel.id, roles: 'channel_user'})},
                },
                roles: {
                    roles: {channel_user: TestHelper.getRoleMock({name: 'channel_user'})},
                },
                teams: {currentTeamId: 'teamId'},
            },
            plugins: {
                components: {
                    ChannelView: registrations,
                },
            },
        } as unknown as Partial<GlobalState>;
    }

    function makeRegistration(partial: Partial<ChannelViewRegistration> = {}): ChannelViewRegistration {
        return {
            id: 'channel-view-reg',
            pluginId: 'test-plugin',
            matcher: () => true,
            component: () => <div data-testid='plugin-channel-view'/>,
            ...partial,
        };
    }

    it('renders the post list and composer when no registration exists', () => {
        renderWithContext(<ConnectedChannelView/>, makeState([]));

        expect(screen.getByTestId('channel-header')).toBeInTheDocument();
        expect(screen.getByTestId('deferred-post-view')).toBeInTheDocument();
        expect(screen.getByTestId('post-create')).toBeInTheDocument();
        expect(screen.queryByTestId('plugin-channel-view')).not.toBeInTheDocument();
    });

    it('renders the post list and composer when no matcher matches', () => {
        renderWithContext(<ConnectedChannelView/>, makeState([makeRegistration({matcher: () => false})]));

        expect(screen.getByTestId('deferred-post-view')).toBeInTheDocument();
        expect(screen.getByTestId('post-create')).toBeInTheDocument();
        expect(screen.queryByTestId('plugin-channel-view')).not.toBeInTheDocument();
    });

    it('renders the plugin component for a matching registration and passes the matcher the channel', () => {
        const matcher = jest.fn((_state: GlobalState, ch: Channel) => ch.id === channel.id);
        renderWithContext(<ConnectedChannelView/>, makeState([makeRegistration({matcher})]));

        expect(matcher).toHaveBeenCalledWith(expect.anything(), channel);
        expect(screen.getByTestId('channel-header')).toBeInTheDocument();
        expect(screen.getByTestId('plugin-channel-view')).toBeInTheDocument();
        expect(markChannelAsRead).toHaveBeenCalledWith(channel.id);
        expect(screen.queryByTestId('deferred-post-view')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-create')).not.toBeInTheDocument();
    });

    it('treats a throwing matcher as no match', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const throwing = makeRegistration({
            id: 'throwing',
            pluginId: 'bad-plugin',
            matcher: () => {
                throw new Error('boom');
            },
        });

        renderWithContext(<ConnectedChannelView/>, makeState([throwing]));
        expect(screen.getByTestId('deferred-post-view')).toBeInTheDocument();
        expect(screen.getByTestId('post-create')).toBeInTheDocument();
        expect(screen.queryByTestId('plugin-channel-view')).not.toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ChannelView: matcher for plugin 'bad-plugin' threw"), expect.any(Error));

        consoleSpy.mockRestore();
    });
});
