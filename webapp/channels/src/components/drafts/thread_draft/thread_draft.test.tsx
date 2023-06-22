// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile, UserStatus} from '@mattermost/types/users';
import {PostDraft} from 'types/store/draft';

import ThreadDraft from './thread_draft';

describe('components/drafts/drafts_row', () => {
    const baseProps = {
        channel: {
            id: '',
        } as Channel,
        channelUrl: '',
        displayName: '',
        draftId: '',
        rootId: '' as UserThread['id'] | UserThreadSynthetic['id'],
        id: {} as Channel['id'],
        status: {} as UserStatus['status'],
        thread: {
            id: '',
        } as UserThread | UserThreadSynthetic,
        type: 'thread' as 'channel' | 'thread',
        user: {} as UserProfile,
        value: {} as PostDraft,
        isRemote: false,
    };

    it('should match snapshot for channel draft', () => {
        const store = mockStore();

        const wrapper = shallow(
            <Provider store={store}>
                <ThreadDraft
                    {...baseProps}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for undefined thread', () => {
        const store = mockStore();

        const props = {
            ...baseProps,
            thread: null as unknown as UserThread | UserThreadSynthetic,
        };

        const wrapper = shallow(
            <Provider store={store}>
                <ThreadDraft
                    {...props}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
