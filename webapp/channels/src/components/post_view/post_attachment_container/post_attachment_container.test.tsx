// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';

import React from 'react';
import {Provider} from 'react-redux';

import {mockStore} from 'tests/test_store';

import PostAttachmentContainer, {Props} from './post_attachment_container';

describe('PostAttachmentContainer', () => {
    const baseProps: Props = {
        children: <p>{'some children'}</p>,
        className: 'permalink',
        link: '/test/pl/1',
    };

    const initialState = {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
        },
    };

    test('should render correctly', async () => {
        const store = await mockStore(initialState);

        const wrapper = shallow(
            <Provider store={store.store}>
                <PostAttachmentContainer {...baseProps}/>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
