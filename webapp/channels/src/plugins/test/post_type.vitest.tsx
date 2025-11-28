// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {Preferences} from 'mattermost-redux/constants';

import PostMessageView from 'components/post_view/post_message_view/post_message_view';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

const PostTypePlugin = () => (
    <span id='pluginId'>{'PostTypePlugin'}</span>
);

vi.mock('components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer', () => {
    return {default: vi.fn(() => <div data-testid='post-preview-property-renderer-mock'>{'PostPreviewPropertyRenderer Mock'}</div>)};
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
        const {container} = renderWithContext(
            <PostMessageView {...requiredProps}/>,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('PostTypePlugin')).toBeInTheDocument();
    });

    test('should match snapshot with no extended post type', () => {
        const props = {...requiredProps, pluginPostTypes: {}};
        const {container} = renderWithContext(
            <PostMessageView {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
