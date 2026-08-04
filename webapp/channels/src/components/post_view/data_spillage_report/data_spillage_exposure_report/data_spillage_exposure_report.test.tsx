// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import DataSpillageExposureReport from 'components/post_view/data_spillage_report/data_spillage_exposure_report/data_spillage_exposure_report';

import {renderWithContext} from 'tests/react_testing_utils';

describe('DataSpillageExposureReport', () => {
    const flaggedPostId = 'flagged_post_id';
    const filename = 'post-exposure-flagged_post_id-1700000000000.csv';

    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(Client4, 'generatePostExposureReport').mockResolvedValue({
            blob: new Blob(['user_id,username\n'], {type: 'text/csv'}),
            filename,
        });

        // jsdom does not implement the object URL APIs, so these cannot be spied on and are
        // saved and restored by hand instead.
        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
        URL.revokeObjectURL = jest.fn();

        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restores every jest.spyOn above, including the ones installed inside individual
        // tests, so cleanup still happens when an assertion fails partway through.
        jest.restoreAllMocks();

        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    test('renders idle download button', () => {
        renderWithContext(
            <DataSpillageExposureReport
                flaggedPostId={flaggedPostId}
                isActionable={true}
            />,
        );

        const button = screen.getByTestId('data-spillage-action-download-exposure-report');
        expect(button).toBeVisible();
        expect(button).toHaveTextContent('Download exposure report');
        expect(button).not.toBeDisabled();
    });

    test('click triggers download and returns to idle on success', async () => {
        renderWithContext(
            <DataSpillageExposureReport
                flaggedPostId={flaggedPostId}
                isActionable={true}
            />,
        );

        await userEvent.click(screen.getByTestId('data-spillage-action-download-exposure-report'));

        await waitFor(() => {
            expect(Client4.generatePostExposureReport).toHaveBeenCalledWith(
                flaggedPostId,
                expect.any(AbortSignal),
            );
        });
        await waitFor(() => {
            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });

        // Returns to idle state
        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-exposure-report')).toHaveTextContent('Download exposure report');
        });
    });

    test('uses the filename returned by the server', async () => {
        jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const anchors: HTMLAnchorElement[] = [];
        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
            const element = originalCreateElement(tagName, options);
            if (tagName === 'a') {
                anchors.push(element as HTMLAnchorElement);
            }
            return element;
        });

        renderWithContext(
            <DataSpillageExposureReport
                flaggedPostId={flaggedPostId}
                isActionable={true}
            />,
        );

        await userEvent.click(screen.getByTestId('data-spillage-action-download-exposure-report'));

        await waitFor(() => {
            expect(anchors).toHaveLength(1);
        });
        expect(anchors[0].download).toBe(filename);
        expect(anchors[0].href).toContain('blob:mock-url');
    });

    test('shows error state when request rejects', async () => {
        jest.spyOn(Client4, 'generatePostExposureReport').mockRejectedValue(new Error('boom'));

        renderWithContext(
            <DataSpillageExposureReport
                flaggedPostId={flaggedPostId}
                isActionable={true}
            />,
        );

        await userEvent.click(screen.getByTestId('data-spillage-action-download-exposure-report'));

        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-exposure-report')).toHaveTextContent('Generation failed. Try again.');
        });
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test('is disabled and shows generating label while in flight, and aborts on unmount', async () => {
        // Hold the request promise open until we unmount
        let resolveRequest: (value: {blob: Blob; filename: string}) => void = () => {};
        const requestPromise = new Promise<{blob: Blob; filename: string}>((resolve) => {
            resolveRequest = resolve;
        });
        jest.spyOn(Client4, 'generatePostExposureReport').mockReturnValue(requestPromise);

        const {unmount} = renderWithContext(
            <DataSpillageExposureReport
                flaggedPostId={flaggedPostId}
                isActionable={true}
            />,
        );

        await userEvent.click(screen.getByTestId('data-spillage-action-download-exposure-report'));

        await waitFor(() => {
            expect(screen.getByTestId('data-spillage-action-download-exposure-report')).toHaveTextContent('Generating…');
        });
        expect(screen.getByTestId('data-spillage-action-download-exposure-report')).toBeDisabled();

        unmount();

        // Resolving after unmount should not trigger a download
        resolveRequest({blob: new Blob(['csv']), filename});
        await Promise.resolve();
        await Promise.resolve();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test('renders the unavailable explanation instead of a button when the review is closed', () => {
        renderWithContext(
            <DataSpillageExposureReport
                flaggedPostId={flaggedPostId}
                isActionable={false}
            />,
        );

        expect(screen.getByTestId('data-spillage-exposure-report-unavailable')).toHaveTextContent('Exposure report is no longer available for this message.');
        expect(screen.queryByTestId('data-spillage-action-download-exposure-report')).not.toBeInTheDocument();
    });
});
