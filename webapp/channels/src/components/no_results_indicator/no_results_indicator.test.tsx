// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen} from 'tests/react_testing_utils';

import {NoResultsVariant, NoResultsLayout} from './types';

describe('components/no_results_indicator', () => {
    test('should render with variant ChannelSearch', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.ChannelSearch}
                    titleValues={{channelName: 'test-channel'}}
                />,
            ),
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText(/No results for/)).toBeInTheDocument();
    });

    test('should render with variant Mentions', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.Mentions}
                />,
            ),
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('No mentions yet')).toBeInTheDocument();
    });

    test('should render with variant FlaggedPosts', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.FlaggedPosts}
                    subtitleValues={{buttonText: 'Save'}}
                />,
            ),
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('No saved messages yet')).toBeInTheDocument();
    });

    test('should render with variant PinnedPosts', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.PinnedPosts}
                    subtitleValues={{text: 'Pin to channel'}}
                />,
            ),
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('No pinned messages yet')).toBeInTheDocument();
    });

    test('should render with variant ChannelFiles', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.ChannelFiles}
                />,
            ),
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('No files yet')).toBeInTheDocument();
    });

    test('should render with variant ChannelFilesFiltered', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.ChannelFilesFiltered}
                />,
            ),
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('No files found')).toBeInTheDocument();
    });

    test('should render when expanded', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    variant={NoResultsVariant.Search}
                    expanded={true}
                    titleValues={{channelName: 'test-channel'}}
                />,
            ),
        );

        // Component renders in expanded state
        expect(screen.getByText(/No results/)).toBeInTheDocument();
    });

    test('should render with horizontal layout', () => {
        render(
            withIntl(
                <NoResultsIndicator
                    iconGraphic={<div data-testid='icon'>{'Icon'}</div>}
                    title={'Test Title'}
                    subtitle={'Subtitle'}
                    layout={NoResultsLayout.Horizontal}
                />,
            ),
        );

        // Test that all content is visible in horizontal layout
        expect(screen.getByTestId('icon')).toBeInTheDocument();
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Subtitle')).toBeInTheDocument();
    });
});
