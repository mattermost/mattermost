// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import SidebarRight from './sidebar_right';
import type {Props} from './sidebar_right';

jest.mock('components/channel_info_rhs', () => () => <div/>);
jest.mock('components/channel_members_rhs', () => () => <div/>);
jest.mock('components/post_edit_history', () => () => <div/>);
jest.mock('components/rhs_card', () => () => <div/>);
jest.mock('components/rhs_thread', () => () => <div data-testid='rhs-thread'/>);
jest.mock('components/search/index', () => ({children}: {children: React.ReactNode}) => <div>{children}</div>);
jest.mock('plugins/rhs_plugin', () => () => <div/>);

describe('components/sidebar_right', () => {
    const channel = {id: 'channel_id', display_name: 'Channel'} as Channel;
    const otherChannel = {id: 'other_channel_id', display_name: 'Other'} as Channel;

    const baseProps: Props = {
        isExpanded: false,
        isOpen: true,
        channel,
        team: {id: 'team_id'} as Props['team'],
        teamId: 'team_id',
        productId: null,
        postRightVisible: true,
        postCardVisible: false,
        searchVisible: false,
        isPinnedPosts: false,
        isChannelFiles: false,
        isChannelInfo: false,
        isChannelMembers: false,
        isPluginView: false,
        isPostEditHistory: false,
        previousRhsState: null,
        rhsChannel: channel,
        selectedPostId: 'post_id',
        selectedPostCardId: '',
        actions: {
            setRhsExpanded: jest.fn(),
            showPinnedPosts: jest.fn(),
            openRHSSearch: jest.fn(),
            closeRightHandSide: jest.fn(),
            openAtPrevious: jest.fn(),
            updateSearchTerms: jest.fn(),
            showChannelFiles: jest.fn(),
            showChannelInfo: jest.fn(),
            loadPostAttributeFields: jest.fn(),
        },
    };

    // The RHS needs its own fetch because the thread it shows need not belong to the
    // channel in the centre — opening one from search or from saved posts puts a post
    // from another channel on screen, and fields are scoped per channel.
    describe('post attribute fields', () => {
        // Mount is not where this happens: the component mounts once for the session
        // and nothing is selected then, so the fetch is driven by the channel changing.
        it('asks for nothing on mount, when nothing is selected', () => {
            renderWithContext(
                <SidebarRight
                    {...baseProps}
                    rhsChannel={undefined}
                />,
            );

            expect(baseProps.actions.loadPostAttributeFields).not.toHaveBeenCalled();
        });

        it('loads them when the RHS opens on a channel', () => {
            const {rerender} = renderWithContext(
                <SidebarRight
                    {...baseProps}
                    rhsChannel={undefined}
                />,
            );

            rerender(<SidebarRight {...baseProps}/>);

            expect(baseProps.actions.loadPostAttributeFields).toHaveBeenCalledTimes(1);
            expect(baseProps.actions.loadPostAttributeFields).toHaveBeenCalledWith('channel_id');
        });

        it('loads them again when the RHS moves to another channel', () => {
            const {rerender} = renderWithContext(<SidebarRight {...baseProps}/>);

            rerender(
                <SidebarRight
                    {...baseProps}
                    rhsChannel={otherChannel}
                />,
            );

            expect(baseProps.actions.loadPostAttributeFields).toHaveBeenCalledTimes(1);
            expect(baseProps.actions.loadPostAttributeFields).toHaveBeenCalledWith('other_channel_id');
        });

        it('does not reload them when the RHS channel has not changed', () => {
            const {rerender} = renderWithContext(<SidebarRight {...baseProps}/>);

            rerender(
                <SidebarRight
                    {...baseProps}
                    isExpanded={true}
                />,
            );

            expect(baseProps.actions.loadPostAttributeFields).not.toHaveBeenCalled();
        });
    });
});
