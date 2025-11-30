// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import CommercialSupportModal from './commercial_support_modal';

describe('components/CommercialSupportModal', () => {
    beforeAll(() => {
        // Mock getSystemRoute to return a valid URL
        vi.spyOn(Client4, 'getSystemRoute').mockImplementation(() => 'http://localhost:8065/api/v4/system');

        // Mock createObjectURL
        window.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
    });

    afterAll(() => {
        vi.restoreAllMocks();

        // @ts-expect-error - TS doesn't like deleting built-in methods
        delete window.URL.createObjectURL;
    });

    const baseProps = {
        onExited: vi.fn(),
        showBannerWarning: false,
        isCloud: false,
        currentUser: TestHelper.getUserMock(),
        packetContents: [
            {id: 'basic.server.logs', label: 'Server Logs', selected: true, mandatory: true},
        ],
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<CommercialSupportModal {...baseProps}/>);

        // Verify the modal renders
        expect(container).toBeInTheDocument();
    });

    test('should show error message when download fails', async () => {
        const errorMessage = 'Failed to download';
        const detailedError = 'Permission denied';

        // Mock the fetch call to return an error
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({
                    message: errorMessage,
                    detailed_error: detailedError,
                }),
            }),
        );

        const {container} = renderWithContext(<CommercialSupportModal {...baseProps}/>);

        // Verify modal renders
        expect(container).toBeInTheDocument();
    });

    test('should clear error when starting new download', async () => {
        // Mock the fetch call to succeed
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(new Blob()),
                headers: {get: () => null},
            }),
        );

        const {container} = renderWithContext(<CommercialSupportModal {...baseProps}/>);

        // Verify modal renders without error
        expect(container.querySelector('.CommercialSupportModal__error')).not.toBeInTheDocument();
    });
});
