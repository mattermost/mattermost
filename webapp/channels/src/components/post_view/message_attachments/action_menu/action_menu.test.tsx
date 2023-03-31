// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ActionMenu from './action_menu';

describe('components/post_view/message_attachments/ActionMenu', () => {
    const baseProps = {
        postId: 'post1',
        action: {
            name: 'action',
            options: [
                {
                    text: 'One',
                    value: '1',
                },
                {
                    text: 'Two',
                    value: '2',
                },
            ],
            id: 'id',
            cookie: 'cookie',
        },
        selected: undefined,
        autocompleteChannels: jest.fn(),
        autocompleteUsers: jest.fn(),
        selectAttachmentMenuAction: jest.fn(),
    };

    test('should start with nothing selected', () => {
        const wrapper = shallow(<ActionMenu {...baseProps}/>);

        expect(wrapper.state()).toMatchObject({
            selected: undefined,
            value: '',
        });
    });

    test('should set selected based on default option', () => {
        const props = {
            ...baseProps,
            action: {
                ...baseProps.action,
                default_option: '2',
            },
        };
        const wrapper = shallow(<ActionMenu {...props}/>);

        expect(wrapper.state()).toMatchObject({
            selected: {
                text: 'Two',
                value: '2',
            },
            value: 'Two',
        });
    });
});
