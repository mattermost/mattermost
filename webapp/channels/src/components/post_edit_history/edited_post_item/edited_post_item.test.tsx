// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';
import type {ComponentProps} from 'react';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {renderWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditedPostItem from './edited_post_item';

import RestorePostModal from '../restore_post_modal';

describe('components/post_edit_history/edited_post_item', () => {
    const baseProps: ComponentProps<typeof EditedPostItem> = {
        post: TestHelper.getPostMock({
            id: 'post_id',
            message: 'post message',
        }),
        isCurrent: false,
        theme: {} as Theme,
        postCurrentVersion: TestHelper.getPostMock({
            id: 'post_current_version_id',
            message: 'post current version message',
        }),
        actions: {
            editPost: jest.fn(),
            closeRightHandSide: jest.fn(),
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<EditedPostItem {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when isCurrent is true', () => {
        const props = {
            ...baseProps,
            isCurrent: true,
        };
        const {container} = renderWithContext(<EditedPostItem {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('clicking on the restore button should call openRestorePostModal', () => {
        renderWithContext(<EditedPostItem {...baseProps}/>);

        // find the button with restore icon and click it
        const restoreButton = screen.getByRole('button', {name: /restore/i});
        fireEvent.click(restoreButton);

        expect(baseProps.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.RESTORE_POST_MODAL,
                dialogType: RestorePostModal,
            }),
        );
    });

    test('when isCurrent is true, should not renderWithContext the restore button', () => {
        const props = {
            ...baseProps,
            isCurrent: true,
        };
        renderWithContext(<EditedPostItem {...props}/>);
        expect(screen.queryByRole('button', {name: /restore/i})).toBeNull();
    });

    test('when isCurrent is true, should renderWithContext the current version text', () => {
        const props = {
            ...baseProps,
            isCurrent: true,
        };
        renderWithContext(<EditedPostItem {...props}/>);
        expect(screen.getByText(/current version/i)).toBeInTheDocument();
    });

    test('should match snapshot with file metadata', () => {
        const props = {
            ...baseProps,
            post: {
                ...baseProps.post,
                metadata: {
                    ...baseProps.post.metadata,
                    files: [
                        TestHelper.getFileInfoMock({id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3}),
                        TestHelper.getFileInfoMock({id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2}),
                        TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1}),
                    ],
                },
            },
        };

        const {container} = renderWithContext(<EditedPostItem {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with file metadata with some deleted files', () => {
        const props = {
            ...baseProps,
            post: {
                ...baseProps.post,
                metadata: {
                    ...baseProps.post.metadata,
                    files: [
                        TestHelper.getFileInfoMock({id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3}),
                        TestHelper.getFileInfoMock({id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2, delete_at: 4}),
                        TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1, delete_at: 4}),
                    ],
                },
            },
        };

        const {container} = renderWithContext(<EditedPostItem {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
