// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {getHistory} from 'utils/browser_history';

import ChannelIdentifierRouter from './channel_identifier_router';

jest.useFakeTimers({legacyFakeTimers: true});

describe('components/channel_layout/CenterChannel', () => {
    const baseProps = {

        match: {
            params: {
                identifier: 'identifier',
                team: 'team',
                path: '/path',
            },
            url: '/team/channel/identifier',
        },

        actions: {
            onChannelByIdentifierEnter: jest.fn(),
        },
        history: [],
    };

    test('should call onChannelByIdentifierEnter on props change', () => {
        const wrapper = shallow(<ChannelIdentifierRouter {...baseProps}/>);
        const instance = wrapper.instance();
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.onChannelByIdentifierEnter).toHaveBeenLastCalledWith(baseProps);

        const props2 = {
            match: {
                params: {
                    identifier: 'identifier2',
                    team: 'team2',
                    path: '/path2',
                },
                url: '/team2/channel/identifier2',
            },
        };
        wrapper.setProps(props2);

        // expect(propsTest.match).toEqual(props2.match);

        //Should clear the timeout if url is changed
        expect(clearTimeout).toHaveBeenCalledWith((instance as any).replaceUrlTimeout);
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
                params: {
                    identifier: 'identifier',
                    team: 'team',
                    path: '/path',
                    postid: 'abcd',
                },
                url: '/team/channel/identifier/abcd',
            },
        };
        shallow(<ChannelIdentifierRouter {...props}/>);
        jest.runOnlyPendingTimers();
        expect(getHistory().replace).toHaveBeenLastCalledWith('/team/channel/identifier');
    });

    test('should call browserHistory.replace on props change to permalink', () => {
        const props = {
            ...baseProps,
            match: {
                params: {
                    identifier: 'identifier1',
                    team: 'team1',
                    path: '/path1',
                    postid: 'abcd',
                },
                url: '/team1/channel/identifier1/abcd',
            },
        };

        const wrapper = shallow(<ChannelIdentifierRouter {...baseProps}/>);
        wrapper.setProps(props);

        jest.runOnlyPendingTimers();
        expect(getHistory().replace).toHaveBeenLastCalledWith('/team1/channel/identifier1');
    });
});
