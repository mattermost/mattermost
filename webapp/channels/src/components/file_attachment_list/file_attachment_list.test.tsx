// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PostMetadata} from '@mattermost/types/posts';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import FileAttachmentList from './index';

describe('FileAttachmentList', () => {
    const post = TestHelper.getPostMock({
        id: 'post_id',
        file_ids: ['file_id_1', 'file_id_2', 'file_id_3'],
    });
    const fileInfos = [
        TestHelper.getFileInfoMock({id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3, post_id: post.id}),
        TestHelper.getFileInfoMock({id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2, post_id: post.id}),
        TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1, post_id: post.id}),
    ];
    const baseProps = {
        post,
        fileCount: 3,
        fileInfos,
        compactDisplay: false,
        enableSVGs: false,
        isEmbedVisible: false,
        locale: 'en',
        handleFileDropdownOpened: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    const defaultState = {
        entities: {
            general: {
                config: {
                    EnableSVGs: 'true',
                },
            },
            posts: {
                posts: {
                    post_id: post,
                },
            },
            files: {
                files: {
                    file_id_1: fileInfos[2],
                    file_id_2: fileInfos[1],
                    file_id_3: fileInfos[0],
                },
                fileIdsByPostId: {
                    post_id: ['file_id_1', 'file_id_2', 'file_id_3'],
                },
            },
        },
    } as unknown as GlobalState;

    test('should render a FileAttachment for a single file', () => {
        const props = {
            ...baseProps,
        };

        renderWithContext(<FileAttachmentList {...props}/>, defaultState);

        expect(screen.getByTestId('fileAttachmentList').querySelectorAll('.post-image__column').length).toBe(3);
    });

    test('should render multiple, sorted FileAttachments for multiple files', () => {
        renderWithContext(<FileAttachmentList {...baseProps}/>, defaultState);

        const fileAttachments = Array.from(screen.getByTestId('fileAttachmentList').querySelectorAll('.post-image__column'));
        expect(fileAttachments.length).toBe(3);
        expect(fileAttachments[0]?.textContent?.includes('image_1.png')).toBe(true);
        expect(fileAttachments[1]?.textContent?.includes('image_2.png')).toBe(true);
        expect(fileAttachments[2]?.textContent?.includes('image_3.png')).toBe(true);
    });

    test('should render a SingleImageView for a single image', () => {
        const props = {
            ...baseProps,
            post: {
                ...baseProps.post,
                file_ids: ['file_id_1'],
            },
        };

        const state = {
            ...defaultState,
            entities: {
                files: {
                    files: {
                        file_id_1: fileInfos[0],
                    },
                    fileIdsByPostId: {
                        post_id: ['file_id_1'],
                    },
                },
            },
        } as unknown as GlobalState;

        const {container} = renderWithContext(<FileAttachmentList {...props}/>, state);

        expect(container.querySelector('.file-view--single')).toBeInTheDocument();
    });

    test('should render a SingleImageView for an SVG with SVG previews enabled', () => {
        const state = {
            ...defaultState,
            entities: {
                general: {
                    config: {
                        EnableSVGs: 'true',
                    },
                },
                files: {
                    files: {
                        file_id_1: TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image.svg', extension: 'svg'}),
                    },
                    fileIdsByPostId: {
                        post_id: ['file_id_1'],
                    },
                },
            },
        } as unknown as GlobalState;

        const props = {
            ...baseProps,
            enableSVGs: true,
        };

        const {container} = renderWithContext(<FileAttachmentList {...props}/>, state);

        expect(container.querySelector('.file-view--single')).toBeInTheDocument();
    });

    test('should render a FileAttachment for an SVG with SVG previews disabled', () => {
        const state = {
            ...defaultState,
            entities: {
                general: {
                    config: {
                        EnableSVGs: 'false',
                    },
                },
                files: {
                    files: {
                        file_id_1: TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image.svg', extension: 'svg'}),
                    },
                    fileIdsByPostId: {
                        post_id: ['file_id_1'],
                    },
                },
            },
        } as unknown as GlobalState;

        const props = {
            ...baseProps,
        };

        renderWithContext(<FileAttachmentList {...props}/>, state);

        expect(screen.getByTestId('fileAttachmentList').querySelector('.file-view--single')).not.toBeInTheDocument();
        expect(screen.getByTestId('fileAttachmentList').querySelector('.post-image__column')).toBeInTheDocument();
    });

    test('should render deleted files', () => {
        const state = {
            ...defaultState,
            entities: {
                files: {
                    files: {
                        file_id_1: TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1, delete_at: 4}),
                        file_id_2: TestHelper.getFileInfoMock({id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2, delete_at: 4}),
                        file_id_3: TestHelper.getFileInfoMock({id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3, delete_at: 4}),
                    },
                    fileIdsByPostId: {
                        post_id: ['file_id_1', 'file_id_2', 'file_id_3'],
                    },
                },
            },
        } as unknown as GlobalState;

        const props = {
            ...baseProps,
        };
        renderWithContext(<FileAttachmentList {...props}/>, state);

        const fileAttachments = screen.getByTestId('fileAttachmentList').querySelectorAll('.post-image__column');
        expect(fileAttachments.length).toBe(3);
        expect(fileAttachments[0]?.textContent?.includes('image_1.png')).toBe(true);
        expect(fileAttachments[1]?.textContent?.includes('image_2.png')).toBe(true);
        expect(fileAttachments[2]?.textContent?.includes('image_3.png')).toBe(true);
    });

    test('should render file list in edit history RHS', () => {
        const fileInfo1 = TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1, delete_at: 4});
        const fileInfo2 = TestHelper.getFileInfoMock({id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2, delete_at: 4});
        const fileInfo3 = TestHelper.getFileInfoMock({id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3, delete_at: 4});

        const state = {
            ...defaultState,
            entities: {
                files: {
                    files: {
                        file_id_1: fileInfo1,
                        file_id_2: fileInfo2,
                        file_id_3: fileInfo3,
                    },
                    fileIdsByPostId: {
                        post_id: ['file_id_1', 'file_id_2', 'file_id_3'],
                    },
                },
                posts: {
                    posts: {
                        post_id: {
                            ...post,
                            metadata: {
                                files: [fileInfo1, fileInfo2, fileInfo3],
                            },
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        // in edit history RHS, files are deleted and download and context menus are disabled
        const props = {
            ...baseProps,
            isEditHistory: true,
            disableDownload: true,
            disableActions: true,
            post: {
                ...post,
                metadata: {
                    files: [fileInfo3, fileInfo2, fileInfo1],
                } as PostMetadata,
            },
        };
        renderWithContext(<FileAttachmentList {...props}/>, state);

        const fileAttachments = screen.getByTestId('fileAttachmentList').querySelectorAll('.post-image__column');
        expect(fileAttachments.length).toBe(3);
        expect(fileAttachments[0]?.textContent?.includes('image_1.png')).toBe(true);
        expect(fileAttachments[1]?.textContent?.includes('image_2.png')).toBe(true);
        expect(fileAttachments[2]?.textContent?.includes('image_3.png')).toBe(true);
    });
});
