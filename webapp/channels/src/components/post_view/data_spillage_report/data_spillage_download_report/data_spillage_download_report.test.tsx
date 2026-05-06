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

    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
        jest.clearAllMocks();

        Client4.generateFlaggedPostReport = jest.fn().mockResolvedValue(new Blob(['report'], {type: 'application/zip'}));

        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
        URL.revokeObjectURL = jest.fn();

        // eslint-disable-next-line no-console
        console.error = jest.fn();
    });

    afterEach(() => {
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
            expect(Client4.generateFlaggedPostReport).toHaveBeenCalledWith(
                flaggedPostId,
                '',
                undefined,
                expect.any(AbortSignal),
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

    test('shows error state when request rejects', async () => {
        Client4.generateFlaggedPostReport = jest.fn().mockRejectedValue(new Error('boom'));

        renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        await userEvent.click(screen.getByTestId('data-spillage-action-download-report'));

        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-report')).toHaveTextContent('Generation failed. Try again.');
        });
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test('aborts in-flight request on unmount', async () => {
        // Hold the request promise open until we unmount
        let resolveRequest: (value: Blob) => void = () => {};
        const requestPromise = new Promise<Blob>((resolve) => {
            resolveRequest = resolve;
        });
        Client4.generateFlaggedPostReport = jest.fn().mockReturnValue(requestPromise);

        const {unmount} = renderWithContext(<DataSpillageDownloadReport flaggedPostId={flaggedPostId}/>);

        await userEvent.click(screen.getByTestId('data-spillage-action-download-report'));

        // While generating, button is disabled and shows generating label
        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-report')).toHaveTextContent('Generating report…');
        });
        expect(screen.getByTestId('data-spillage-action-download-report')).toBeDisabled();

        unmount();

        // Resolving after unmount should not trigger a download
        resolveRequest(new Blob(['report']));
        await Promise.resolve();
        await Promise.resolve();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});
