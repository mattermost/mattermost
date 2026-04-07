// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import MsgTyping from './msg_typing';

describe('components/MsgTyping', () => {
    const baseProps = {
        typingUsers: [],
        channelId: 'test',
        rootId: '',
        userStartedTyping: jest.fn(),
        userStoppedTyping: jest.fn(),
    };

    test('should match snapshot, on nobody typing', async () => {
        const {container} = await renderWithContext(<MsgTyping {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on one user typing', async () => {
        const typingUsers = ['test.user'];
        const props = {...baseProps, typingUsers};

        const {container} = await renderWithContext(<MsgTyping {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on multiple users typing', async () => {
        const typingUsers = ['test.user', 'other.test.user', 'another.user'];
        const props = {...baseProps, typingUsers};

        const {container} = await renderWithContext(<MsgTyping {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
