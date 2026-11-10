// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import type {History} from 'history';
import React from 'react';

import {getHistory} from 'utils/browser_history';

import ChannelIdentifierRouter from './channel_identifier_router';

jest.mock('components/channel_view/index', () => ({
    __esModule: true,
    default: () => null,
}));

const mockReplace = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({replace: mockReplace}),
}));

jest.useFakeTimers({legacyFakeTimers: true});

describe('components/channel_layout/ChannelIdentifierRouter', () => {
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
            onChannelByIdentifierEnter: jest.fn(),
        },
        history: [] as unknown as History,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should call onChannelByIdentifierEnter on props change', () => {
        const {rerender} = render(<ChannelIdentifierRouter {...baseProps}/>);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenLastCalledWith(baseProps);

        const props2 = {
            ...baseProps,
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
        rerender(<ChannelIdentifierRouter {...props2}/>);

        expect(clearTimeout).toHaveBeenCalled();
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenLastCalledWith(props2);
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
        render(<ChannelIdentifierRouter {...props}/>);
        jest.runOnlyPendingTimers();
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

        const {rerender} = render(<ChannelIdentifierRouter {...baseProps}/>);
        rerender(<ChannelIdentifierRouter {...props}/>);

        jest.runOnlyPendingTimers();
        expect(getHistory().replace).toHaveBeenLastCalledWith('/team1/channel/identifier1');
    });
});
