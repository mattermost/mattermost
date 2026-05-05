// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import DataSpillageDownloadReport from 'components/post_view/data_spillage_report/data_spillage_download_report/data_spillage_download_report';

import {renderWithContext} from 'tests/react_testing_utils';

describe('DataSpillageDownloadReport', () => {
    const flaggedPostId = 'flagged_post_id';
    const reportUrl = '/api/v4/content_flagging/post/flagged_post_id/report';

    let originalFetch: typeof global.fetch;
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    const mockFetchSuccess = () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            blob: () => Promise.resolve(new Blob(['report'], {type: 'application/zip'})),
        }) as jest.Mock;
    };

    const mockFetchHttpError = () => {
        global.fetch = jest.fn().mockResolvedValue({ok: false, status: 500}) as jest.Mock;
    };

    const mockFetchReject = () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        Client4.getFlaggedPostReportUrl = jest.fn().mockReturnValue(reportUrl);

        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
        URL.revokeObjectURL = jest.fn();

        originalFetch = global.fetch;
        mockFetchSuccess();

        // eslint-disable-next-line no-console
        console.error = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    test('renders idle Download Report button', () => {
        renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        const button = screen.getByTestId('data-spillage-action-download-report');
        expect(button).toBeVisible();
        expect(button).toHaveTextContent('Download Report');
        expect(button).not.toBeDisabled();
    });

    test('click triggers download and returns to idle on success', async () => {
        renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        await userEvent.click(screen.getByTestId('data-spillage-action-download-report'));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                reportUrl,
                expect.objectContaining({credentials: 'include'}),
            );
        });
        await waitFor(() => {
            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });

        // Returns to idle state
        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-report')).toHaveTextContent('Download Report');
        });
    });

    test('shows error state when response is not ok', async () => {
        mockFetchHttpError();

        renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        await userEvent.click(screen.getByTestId('data-spillage-action-download-report'));

        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-report')).toHaveTextContent('Generation failed. Try again.');
        });
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test('shows error state when fetch rejects', async () => {
        mockFetchReject();

        renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        await userEvent.click(screen.getByTestId('data-spillage-action-download-report'));

        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-report')).toHaveTextContent('Generation failed. Try again.');
        });
    });

    test('aborts in-flight request on unmount', async () => {
        // Hold the fetch promise open until we unmount
        let resolveFetch: (value: any) => void = () => {};
        const fetchPromise = new Promise((resolve) => {
            resolveFetch = resolve;
        });
        global.fetch = jest.fn().mockReturnValue(fetchPromise) as jest.Mock;

        const {unmount} = renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        await userEvent.click(screen.getByTestId('data-spillage-action-download-report'));

        // While generating, button is disabled and shows generating label
        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-report')).toHaveTextContent('Generating report…');
        });
        expect(screen.getByTestId('data-spillage-action-download-report')).toBeDisabled();

        unmount();

        // Resolving after unmount should not trigger a download
        resolveFetch({
            ok: true,
            status: 200,
            blob: () => Promise.resolve(new Blob(['report'])),
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});
