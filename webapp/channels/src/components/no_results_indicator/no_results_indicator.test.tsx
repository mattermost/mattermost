// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';

import {NoResultsVariant, NoResultsLayout} from './types';

describe('components/no_results_indicator', () => {
    test('should match snapshot with default props', () => {
        const wrapper = shallow(
            <NoResultsIndicator/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelSearch', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelSearch}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with variant Mentions', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.Mentions}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with variant FlaggedPosts', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.FlaggedPosts}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with variant PinnedPosts', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.PinnedPosts}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFiles', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelFiles}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFilesFiltered', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelFilesFiltered}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when expanded', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                variant={NoResultsVariant.ChannelSearch}
                expanded={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with horizontal layout', () => {
        const wrapper = shallow(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                title={'Test'}
                subtitle={'Subtitle'}
                layout={NoResultsLayout.Horizontal}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
