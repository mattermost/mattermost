// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {screen} from '@testing-library/react';

import {Preferences} from 'mattermost-redux/constants';

import PostMessageView from 'components/post_view/post_message_view/post_message_view';
import {renderWithContext} from 'tests/react_testing_utils';

// Mock the ShowMore component to avoid context issues
jest.mock('components/post_view/show_more', () => () => <div data-testid="show-more">Show More</div>);

const PostTypePlugin = () => (
    <span data-testid='pluginId'>{'PostTypePlugin'}</span>
);

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

    test('should render properly with extended post type', () => {
        const {container} = renderWithContext(
            <PostMessageView {...requiredProps}/>,
        );

        // Testing that the custom plugin component renders
        expect(screen.getByTestId('pluginId')).toBeInTheDocument();
        expect(screen.getByText('PostTypePlugin')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should render properly with no extended post type', () => {
        const props = {...requiredProps, pluginPostTypes: {}};
        const {container} = renderWithContext(
            <PostMessageView {...props}/>,
        );

        // When no plugin post type is available, it should not render the plugin component
        expect(screen.queryByTestId('pluginId')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
