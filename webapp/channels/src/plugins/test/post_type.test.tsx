// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow, mount} from 'enzyme';
import type {ComponentProps} from 'react';
import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import PostMessageView from 'components/post_view/post_message_view/post_message_view';

const PostTypePlugin = () => (
    <span id='pluginId'>{'PostTypePlugin'}</span>
);

jest.mock('components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer', () => {
    return jest.fn(() => <div data-testid='post-preview-property-renderer-mock'>{'PostPreviewPropertyRenderer Mock'}</div>);
});

describe('plugins/PostMessageView', () => {
    const post = {type: 'testtype', message: 'this is some text', id: 'post_id'} as any;

    const requiredProps: ComponentProps<typeof PostMessageView> = {
        post,
        pluginPostTypes: {
            testtype: {
                id: 'some id',
                pluginId: 'some plugin id',
                component: PostTypePlugin,
                type: '',
            },
        },
        theme: Preferences.THEMES.denim,
        enableFormatting: true,
        currentRelativeTeamUrl: 'team_url',
    };

    test('should match snapshot with extended post type', () => {
        const wrapper = mount(
            <PostMessageView {...requiredProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('#pluginId').text()).toBe('PostTypePlugin');
    });

    test('should match snapshot with no extended post type', () => {
        const props = {...requiredProps, pluginPostTypes: {}};
        const wrapper = shallow(
            <PostMessageView {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
