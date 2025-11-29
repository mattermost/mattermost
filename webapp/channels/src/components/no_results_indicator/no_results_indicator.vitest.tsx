// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';

import {renderWithContext, cleanup, act} from 'tests/vitest_react_testing_utils';

import {NoResultsVariant, NoResultsLayout} from './types';

describe('components/no_results_indicator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        await act(async () => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
        cleanup();
    });

    test('should match snapshot with default props', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator/>,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelSearch', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.ChannelSearch}
                    titleValues={{channelName: 'test-channel'}}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with variant Mentions', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.Mentions}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with variant FlaggedPosts', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.FlaggedPosts}
                    subtitleValues={{buttonText: <strong>{'Save'}</strong>}}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with variant PinnedPosts', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.PinnedPosts}
                    subtitleValues={{text: <strong>{'Pin'}</strong>}}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFiles', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.ChannelFiles}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with variant ChannelFilesFiltered', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    variant={NoResultsVariant.ChannelFilesFiltered}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot when expanded', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    variant={NoResultsVariant.Search}
                    expanded={true}
                    titleValues={{channelName: 'test-channel'}}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with horizontal layout', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <NoResultsIndicator
                    iconGraphic={<div>{'Test'}</div>}
                    title={'Test'}
                    subtitle={'Subtitle'}
                    layout={NoResultsLayout.Horizontal}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });
});
