// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';

import {renderWithContext} from 'tests/react_testing_utils';

import {NoResultsVariant, NoResultsLayout} from './types';

describe('components/no_results_indicator', () => {
    test('should match snapshot with default props', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelSearch', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelSearch}
                titleValues={{channelName: 'test-channel'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant Mentions', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.Mentions}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant FlaggedPosts', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.FlaggedPosts}
                subtitleValues={{buttonText: 'Save'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant PinnedPosts', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.PinnedPosts}
                subtitleValues={{text: 'Pin to Channel'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFiles', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelFiles}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFilesFiltered', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                iconGraphic={<div>{'Test'}</div>}
                variant={NoResultsVariant.ChannelFilesFiltered}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when expanded', async () => {
        const {container} = await renderWithContext(
            <NoResultsIndicator
                variant={NoResultsVariant.Search}
                expanded={true}
                titleValues={{channelName: 'test-channel'}}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with horizontal layout', async () => {
        const {container} = await renderWithContext(
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
