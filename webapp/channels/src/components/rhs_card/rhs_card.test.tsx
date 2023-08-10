// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import RhsCard from './rhs_card';

import type {ComponentProps} from 'react';
import type {PostPluginComponent} from 'types/store/plugins';
import type {RhsState} from 'types/store/rhs';

describe('comoponents/rhs_card/RhsCard', () => {
    const post = TestHelper.getPostMock({
        id: '123',
        message: 'test',
        create_at: 1542994995740,
        props: {},
    });

    const baseProps: ComponentProps<typeof RhsCard> = {
        isMobileView: false,
        pluginPostCardTypes: {postType: {} as PostPluginComponent},
        teamUrl: 'test-team-url',
        enablePostUsernameOverride: false,
        previousRhsState: {} as RhsState,
    };

    it('should match when no post is selected', () => {
        const wrapper = shallow(
            <RhsCard
                {...baseProps}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match on post when no plugin defining card types', () => {
        const wrapper = shallow(
            <RhsCard
                {...baseProps}
                selected={post}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match on post when plugin defining card types don\'t match with the post type', () => {
        const wrapper = shallow(
            <RhsCard
                {...baseProps}
                selected={post}
                pluginPostCardTypes={{notMatchingType: {component: () => <i/>} as unknown as PostPluginComponent}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match on post when plugin defining card types match with the post type', () => {
        const wrapper = shallow(
            <RhsCard
                {...baseProps}
                selected={post}
                pluginPostCardTypes={{test: {component: () => <i/>} as unknown as PostPluginComponent}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
