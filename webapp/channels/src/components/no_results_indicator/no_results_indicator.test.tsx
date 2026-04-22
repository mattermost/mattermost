// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';

import {renderWithContext} from 'tests/react_testing_utils';

import {NoResultsVariant, NoResultsLayout} from './types';

describe('components/no_results_indicator', () => {
    test('should match snapshot with default props', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelSearch', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelSearch}
                titleValues={{channelName: 'test-channel'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant Mentions', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.Mentions}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant FlaggedPosts', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.FlaggedPosts}
                subtitleValues={{buttonText: 'Save'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant PinnedPosts', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.PinnedPosts}
                subtitleValues={{text: 'Pin to Channel'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFiles', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelFiles}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFilesFiltered', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelFilesFiltered}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when expanded', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                variant={NoResultsVariant.Search}
                expanded={true}
                titleValues={{channelName: 'test-channel'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with horizontal layout', () => {
        const {container} = renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                title={'Test'}
                subtitle={'Subtitle'}
                layout={NoResultsLayout.Horizontal}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
