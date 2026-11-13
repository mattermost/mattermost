// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
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
        postCurrentVersion: TestHelper.getPostMock({
            id: 'post_current_version_id',
            message: 'post current version message',
        }),
        actions: {
            editPost: jest.fn(),
            closeRightHandSide: jest.fn(),
            openModal: jest.fn(),
        },
        isChannelAutotranslated: false,
    };

    test('clicking on the restore button should call openRestorePostModal', async () => {
        renderWithContext(<EditedPostItem {...baseProps}/>);

        // find the button with restore icon and click it
        const restoreButton = screen.getByRole('button', {name: /restore/i});
        await userEvent.click(restoreButton);

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
});
