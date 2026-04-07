// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import * as fileActions from 'mattermost-redux/actions/files';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';
import * as Utils from 'utils/utils';

import FilePreviewModalMainActions from './file_preview_modal_main_actions';

describe('components/file_preview_modal/file_preview_modal_main_actions/FilePreviewModalMainActions', () => {
    let defaultProps: ComponentProps<typeof FilePreviewModalMainActions>;
    beforeEach(() => {
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

    test('should match snapshot with public links disabled', async () => {
        const props = {
            ...defaultProps,
            enablePublicLink: false,
        };

        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.queryByLabelText('Get a public link')).not.toBeInTheDocument();
    });

    test('should match snapshot with public links enabled', async () => {
        const props = {
            ...defaultProps,
            enablePublicLink: true,
        };

        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.queryByLabelText('Get a public link')).toBeInTheDocument();
    });

    test('should not show public link button for external image with public links enabled', async () => {
        const props = {
            ...defaultProps,
            enablePublicLink: true,
            showPublicLink: false,
        };

        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.queryByLabelText('Get a public link')).not.toBeInTheDocument();
    });

    test('should show copy button when copy content is enabled', async () => {
        const props = {
            ...defaultProps,
            canCopyContent: true,
        };

        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
    });

    test('should call public link callback', async () => {
        const spy = jest.spyOn(Utils, 'copyToClipboard');
        const props = {
            ...defaultProps,
            enablePublicLink: true,
        };
        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );

        expect(spy).toHaveBeenCalledTimes(0);

        await userEvent.click(screen.getByLabelText('Get a public link'));

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should not get public api when public links is disabled', async () => {
        const spy = jest.spyOn(fileActions, 'getFilePublicLink');
        await renderWithContext(
            <FilePreviewModalMainActions {...defaultProps}/>,
        );
        expect(spy).toHaveBeenCalledTimes(0);
    });

    test('should get public api when public links is enabled', async () => {
        const spy = jest.spyOn(fileActions, 'getFilePublicLink');
        const props = {
            ...defaultProps,
            enablePublicLink: true,
        };
        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should copy the content to clipboard', async () => {
        const spy = jest.spyOn(Utils, 'copyToClipboard');
        const props = {
            ...defaultProps,
            canCopyContent: true,
        };
        await renderWithContext(
            <FilePreviewModalMainActions {...props}/>,
        );
        expect(spy).toHaveBeenCalledTimes(0);
        await userEvent.click(screen.getByLabelText('Copy code'));
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
