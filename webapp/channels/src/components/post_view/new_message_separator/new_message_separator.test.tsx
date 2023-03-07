// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import NewMessageSeparator from './new_message_separator';

describe('components/post_view/new_message_separator', () => {
    test('should render new_message_separator', () => {
        const wrapper = shallow(
            <NewMessageSeparator separatorId='1234'/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
