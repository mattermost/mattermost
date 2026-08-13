// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import FilePreview from './file_preview';

describe('FilePreview', () => {
    const onRemove = jest.fn();
    const openModal = jest.fn();
    const fileInfos = [
        {
            width: 100,
            height: 100,
            name: 'test_filename',
            id: 'file_id_1',
            type: 'image/png',
            extension: 'png',
            has_preview_image: true,
            user_id: 'user_id_1',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    ];
    const uploadsInProgress = ['clientID_1'];
    const uploadsProgressPercent = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        clientID_1: {
            width: 100,
            height: 100,
            name: 'file',
            percent: 50,
            extension: 'image/png',
            id: 'file_id_1',
            has_preview_image: true,
            user_id: '',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    };

    const baseProps = {
        enableSVGs: false,
        fileInfos,
        uploadsInProgress,
        onRemove,
        uploadsProgressPercent,
        actions: {
            openModal,
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <FilePreview {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when props are changed', () => {
        const {container, rerender} = renderWithContext(
            <FilePreview {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
        const fileInfo2 = {
            ...baseProps.fileInfos[0],
            id: 'file_id_2',
            create_at: 2,
            extension: 'jpg',
            name: 'file_two.jpg',
            size: 120,
        };
        const newFileInfos = [...fileInfos, fileInfo2];
        rerender(
            <FilePreview
                {...baseProps}
                fileInfos={newFileInfos}
                uploadsInProgress={[]}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call handleRemove when file removed', async () => {
        const newOnRemove = jest.fn();
        const props = {...baseProps, onRemove: newOnRemove};
        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        const user = userEvent.setup();
        const removeLink = container.querySelector('a.file-preview__remove');
        if (!removeLink) {
            throw new Error('Remove link not found');
        }
        await user.click(removeLink);
        expect(newOnRemove).toHaveBeenCalled();
    });

    test('should call openModal when image thumbnail is clicked', async () => {
        openModal.mockClear();
        renderWithContext(
            <FilePreview {...baseProps}/>,
        );

        const user = userEvent.setup();
        const thumb = screen.getByLabelText(/file thumbnail.*test_filename/i);
        await user.click(thumb);

        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                post: {user_id: 'user_id_1', channel_id: 'channel_id'},
                fileInfos,
                startIndex: 0,
            },
        });
    });

    test('should call openModal when non-image file thumbnail is clicked', async () => {
        const pdfFileInfos = [{
            ...fileInfos[0],
            id: 'file_id_pdf',
            name: 'document.pdf',
            type: 'application/pdf',
            extension: 'pdf',
            width: 0,
            height: 0,
            has_preview_image: false,
        }];
        openModal.mockClear();
        renderWithContext(
            <FilePreview
                {...baseProps}
                fileInfos={pdfFileInfos}
                uploadsInProgress={[]}
            />,
        );

        const user = userEvent.setup();
        const thumb = screen.getByLabelText(/file thumbnail.*document\.pdf/i);
        await user.click(thumb);

        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                post: {user_id: 'user_id_1', channel_id: 'channel_id'},
                fileInfos: pdfFileInfos,
                startIndex: 0,
            },
        });
    });

    /** Direct handler coverage: thumbnails for archived/deleted files are non-links, but guards must stay aligned. */
    const thumbnailClickMouseEvent = () =>
        ({
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
            blur: jest.fn(),
            target: document.createElement('a'),
        }) as unknown as React.MouseEvent<HTMLElement>;

    test('should not open preview modal via handler when attachment is archived', () => {
        const openModalFn = jest.fn();
        const archivedInfos = [{...fileInfos[0], archived: true}];
        const instance = new FilePreview({
            enableSVGs: false,
            fileInfos: archivedInfos,
            uploadsInProgress: [],
            uploadsProgressPercent: {},
            actions: {openModal: openModalFn},
        });

        instance.handleThumbnailPreviewClick(thumbnailClickMouseEvent(), 0);

        expect(openModalFn).not.toHaveBeenCalled();
    });

    test('should not open preview modal via handler when attachment has delete_at set', () => {
        const openModalFn = jest.fn();
        const deletedInfos = [{...fileInfos[0], delete_at: 999}];
        const instance = new FilePreview({
            enableSVGs: false,
            fileInfos: deletedInfos,
            uploadsInProgress: [],
            uploadsProgressPercent: {},
            actions: {openModal: openModalFn},
        });

        instance.handleThumbnailPreviewClick(thumbnailClickMouseEvent(), 0);

        expect(openModalFn).not.toHaveBeenCalled();
    });

    test('should render non-interactive thumbnail wrapper when attachment is archived or deleted', () => {
        const {container, rerender} = renderWithContext(
            <FilePreview
                {...baseProps}
                fileInfos={[{...fileInfos[0], archived: true}]}
                uploadsInProgress={[]}
            />,
        );

        expect(container.querySelector('.post-image__thumbnail')).toBeTruthy();
        expect(container.querySelector('a.post-image__thumbnail')).not.toBeInTheDocument();

        rerender(
            <FilePreview
                {...baseProps}
                fileInfos={[{...fileInfos[0], delete_at: 1}]}
                uploadsInProgress={[]}
            />,
        );

        expect(container.querySelector('a.post-image__thumbnail')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('link', {name: /file thumbnail/i})).toHaveLength(0);
    });

    test('should not render an SVG when SVGs are disabled', () => {
        const props = {
            ...baseProps,
            fileInfos: [
                {
                    ...baseProps.fileInfos[0],
                    type: 'image/svg',
                    extension: 'svg',
                },
            ],
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(screen.queryByAltText('file preview')).not.toBeInTheDocument();
        expect(container.querySelector('.file-icon.generic')).toBeInTheDocument();
    });

    test('should render an SVG when SVGs are enabled', () => {
        const fileId = 'file_id_1';
        const props = {
            ...baseProps,
            enableSVGs: true,
            fileInfos: [
                {
                    ...baseProps.fileInfos[0],
                    type: 'image/svg',
                    extension: 'svg',
                },
            ],
        };

        renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(screen.getByAltText('file preview')).toHaveAttribute('src', getFileUrl(fileId));
    });

    test('should add compact classes when compactMode is true', () => {
        const props = {
            ...baseProps,
            compactMode: true,
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(container.querySelector('.file-preview.post-image__column.compact')).toBeInTheDocument();
        expect(container.querySelector('.post-image__detail.compact')).toBeInTheDocument();
        expect(container.querySelector('.file-preview__remove.compact')).toBeInTheDocument();
    });

    test('should render disabled remove button with tooltip when onRemove is absent and disabledRemoveTooltip is provided', async () => {
        const props = {
            ...baseProps,
            onRemove: undefined,
            uploadsInProgress: [],
            disabledRemoveTooltip: 'You do not have permission to edit file attachments',
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        const disabledRemove = container.querySelector('.file-preview__remove--disabled');
        expect(disabledRemove).toBeInTheDocument();
        expect(container.querySelector('a.file-preview__remove')).not.toBeInTheDocument();
        if (!disabledRemove) {
            throw new Error('Disabled remove button not found');
        }

        const user = userEvent.setup();
        await user.hover(disabledRemove);
        expect(await screen.findByText('You do not have permission to edit file attachments')).toBeInTheDocument();

        expect(container.querySelector('a.file-preview__remove')).not.toBeInTheDocument();
    });

    test('should render normal remove button when onRemove is defined', () => {
        const props = {
            ...baseProps,
            onRemove: jest.fn(),
            uploadsInProgress: [],
            disabledRemoveTooltip: 'tooltip text',
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(container.querySelector('a.file-preview__remove')).toBeInTheDocument();
        expect(container.querySelector('.file-preview__remove--disabled')).not.toBeInTheDocument();
    });

    test('should not render any remove button when onRemove is absent and no disabledRemoveTooltip', () => {
        const props = {
            ...baseProps,
            onRemove: undefined,
            uploadsInProgress: [],
            disabledRemoveTooltip: undefined,
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(container.querySelector('a.file-preview__remove')).not.toBeInTheDocument();
        expect(container.querySelector('.file-preview__remove--disabled')).not.toBeInTheDocument();
    });

    test('should not add compact classes when compactMode is false', () => {
        const props = {
            ...baseProps,
            compactMode: false,
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(container.querySelector('.file-preview.post-image__column.compact')).not.toBeInTheDocument();
        expect(container.querySelector('.post-image__detail.compact')).not.toBeInTheDocument();
        expect(container.querySelector('.file-preview__remove.compact')).not.toBeInTheDocument();
    });
});
