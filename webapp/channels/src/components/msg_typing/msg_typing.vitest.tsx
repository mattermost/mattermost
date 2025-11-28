// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import MsgTyping from 'components/msg_typing/msg_typing';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/MsgTyping', () => {
    const baseProps = {
        typingUsers: [] as string[],
        channelId: 'test',
        rootId: '',
        userStartedTyping: vi.fn(),
        userStoppedTyping: vi.fn(),
    };

    test('should match snapshot, on nobody typing', () => {
        const {container} = renderWithContext(<MsgTyping {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on one user typing', () => {
        const typingUsers = ['test.user'];
        const props = {...baseProps, typingUsers};

        const {container} = renderWithContext(<MsgTyping {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on multiple users typing', () => {
        const typingUsers = ['test.user', 'other.test.user', 'another.user'];
        const props = {...baseProps, typingUsers};

        const {container} = renderWithContext(<MsgTyping {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
