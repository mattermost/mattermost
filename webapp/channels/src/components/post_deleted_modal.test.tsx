// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PostDeletedModal from 'components/post_deleted_modal';

describe('components/ChannelInfoModal', () => {
    const baseProps = {
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <PostDeletedModal {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
