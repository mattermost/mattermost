// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('utils/utils', () => ({
    copyToClipboard: jest.fn(),
    getFileType: jest.fn(() => 'code'),
}));

jest.mock('mattermost-redux/actions/files', () => ({
    getFilePublicLink: jest.fn(() => ({type: 'GET_FILE_PUBLIC_LINK'})),
}));

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import FilePreviewModalMainActions from './file_preview_modal_main_actions';

const {copyToClipboard} = jest.requireMock('utils/utils');
const {getFilePublicLink} = jest.requireMock('mattermost-redux/actions/files');

describe('components/file_preview_modal/file_preview_modal_main_actions/FilePreviewModalMainActions', () => {
    let defaultProps: ComponentProps<typeof FilePreviewModalMainActions>;
    beforeEach(() => {
        jest.clearAllMocks();
        defaultProps = {
            fileInfo: TestHelper.getFileInfoMock({}),
            enablePublicLink: false,
            canDownloadFiles: true,
            showPublicLink: true,
            fileURL: 'http://example.com/img.png',
            filename: 'img.png',
            handleModalClose: jest.fn(),
            content: 'test content',
            canCopyContent: false,
        };
    });

    test('should match snapshot with public links disabled', () => {
        const props = {
            ...defaultProps,
            enablePublicLink: false,
        };

        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.queryByLabelText('Get a public link')).not.toBeInTheDocument();
    });

    test('should match snapshot with public links enabled', () => {
        const props = {
            ...defaultProps,
            enablePublicLink: true,
        };

        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.queryByLabelText('Get a public link')).toBeInTheDocument();
    });

    test('should not show public link button for external image with public links enabled', () => {
        const props = {
            ...defaultProps,
            enablePublicLink: true,
            showPublicLink: false,
        };

        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.queryByLabelText('Get a public link')).not.toBeInTheDocument();
    });

    test('should show copy button when copy content is enabled', () => {
        const props = {
            ...defaultProps,
            canCopyContent: true,
        };

        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
    });

    test('should call public link callback', async () => {
        const props = {
            ...defaultProps,
            enablePublicLink: true,
        };
        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(copyToClipboard).toHaveBeenCalledTimes(0);

        await userEvent.click(screen.getByLabelText('Get a public link'));

        expect(copyToClipboard).toHaveBeenCalledTimes(1);
    });

    test('should not get public api when public links is disabled', async () => {
        renderWithContext(
            <FilePreviewModalMainActions {...defaultProps}/>,
        );
        expect(getFilePublicLink).toHaveBeenCalledTimes(0);
    });

    test('should get public api when public links is enabled', async () => {
        const props = {
            ...defaultProps,
            enablePublicLink: true,
        };
        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );
        expect(getFilePublicLink).toHaveBeenCalledTimes(1);
    });

    test('should copy the content to clipboard', async () => {
        const props = {
            ...defaultProps,
            canCopyContent: true,
        };
        renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );
        expect(copyToClipboard).toHaveBeenCalledTimes(0);
        await userEvent.click(screen.getByLabelText('Copy code'));
        expect(copyToClipboard).toHaveBeenCalledTimes(1);
    });
});
