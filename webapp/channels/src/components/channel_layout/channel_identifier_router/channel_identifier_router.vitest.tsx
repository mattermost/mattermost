// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {History} from 'history';
import React from 'react';

import {act, renderWithContext} from 'tests/vitest_react_testing_utils';
import {getHistory} from 'utils/browser_history';

import ChannelIdentifierRouter from './channel_identifier_router';

vi.useFakeTimers();

describe('components/channel_layout/CenterChannel', () => {
    const baseProps = {

        match: {
            isExact: false,
            params: {
                identifier: 'identifier',
                team: 'team',
                path: '/path',
            },
            path: '/team/channel/identifier',
            url: '/team/channel/identifier',
        },

        actions: {
            onChannelByIdentifierEnter: vi.fn(),
        },
        history: [] as unknown as History,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should call onChannelByIdentifierEnter on props change', () => {
        const {rerender} = renderWithContext(<ChannelIdentifierRouter {...baseProps}/>);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenLastCalledWith(baseProps);

        const props2 = {
            match: {
                isExact: false,
                params: {
                    identifier: 'identifier2',
                    team: 'team2',
                    path: '/path2',
                },
                path: '/team2/channel/identifier2',
                url: '/team2/channel/identifier2',
            },
        };

        rerender(
            <ChannelIdentifierRouter
                {...baseProps}
                match={props2.match}
            />,
        );

        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenLastCalledWith({
            ...baseProps,
            match: props2.match,
            actions: baseProps.actions,
        });
    });

    test('should call browserHistory.replace if it is permalink after timer', () => {
        const props = {
            ...baseProps,
            match: {
                isExact: false,
                params: {
                    identifier: 'identifier',
                    team: 'team',
                    path: '/path',
                    postid: 'abcd',
                },
                path: '/team/channel/identifier/abcd',
                url: '/team/channel/identifier/abcd',
            },
        };
        renderWithContext(<ChannelIdentifierRouter {...props}/>);
        act(() => {
            vi.runOnlyPendingTimers();
        });
        expect(getHistory().replace).toHaveBeenLastCalledWith('/team/channel/identifier');
    });

    test('should call browserHistory.replace on props change to permalink', () => {
        const props = {
            ...baseProps,
            match: {
                isExact: false,
                params: {
                    identifier: 'identifier1',
                    team: 'team1',
                    path: '/path1',
                    postid: 'abcd',
                },
                path: '/team1/channel/identifier1/abcd',
                url: '/team1/channel/identifier1/abcd',
            },
        };

        const {rerender} = renderWithContext(<ChannelIdentifierRouter {...baseProps}/>);
        rerender(
            <ChannelIdentifierRouter
                {...baseProps}
                match={props.match}
            />,
        );

        act(() => {
            vi.runOnlyPendingTimers();
        });
        expect(getHistory().replace).toHaveBeenLastCalledWith('/team1/channel/identifier1');
    });
});
