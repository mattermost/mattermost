// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostPluginComponent} from 'types/store/plugins';
import type {RhsState} from 'types/store/rhs';

import RhsCard from './rhs_card';

describe('comoponents/rhs_card/RhsCard', () => {
    const post = TestHelper.getPostMock({
        id: '123',
        message: 'test',
        create_at: 1542994995740,
        props: {},
    });

    const baseProps = {
        isMobileView: false,
        pluginPostCardTypes: {postType: {} as PostPluginComponent},
        teamUrl: 'test-team-url',
        enablePostUsernameOverride: false,
        previousRhsState: {} as RhsState,
    };

    it('should match when no post is selected', () => {
        const {container} = renderWithContext(
            <RhsCard
                {...baseProps}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match on post when no plugin defining card types', () => {
        const {container} = renderWithContext(
            <RhsCard
                {...baseProps}
                selected={post}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match on post when plugin defining card types don\'t match with the post type', () => {
        const {container} = renderWithContext(
            <RhsCard
                {...baseProps}
                selected={post}
                pluginPostCardTypes={{notMatchingType: {component: () => <i/>} as unknown as PostPluginComponent}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match on post when plugin defining card types match with the post type', () => {
        const {container} = renderWithContext(
            <RhsCard
                {...baseProps}
                selected={post}
                pluginPostCardTypes={{test: {component: () => <i/>} as unknown as PostPluginComponent}}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
