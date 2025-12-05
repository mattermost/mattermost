// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithIntl, screen, waitFor} from 'tests/vitest_react_testing_utils';

import DeleteDraftModal from './delete_draft_modal';

describe('components/drafts/draft_actions/delete_draft_modal', () => {
    const baseProps = {
        displayName: 'display_name',
        onConfirm: vi.fn(),
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithIntl(
            <DeleteDraftModal
                {...baseProps}
            />,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should have called onConfirm', async () => {
        const onConfirm = vi.fn();
        renderWithIntl(
            <DeleteDraftModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        const confirmButton = screen.getByRole('button', {name: /yes, delete/i});
        await userEvent.click(confirmButton);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    test('should have called onExited', async () => {
        const onExited = vi.fn();
        renderWithIntl(
            <DeleteDraftModal
                {...baseProps}
                onExited={onExited}
            />,
        );

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await userEvent.click(cancelButton);

        await waitFor(() => {
            expect(onExited).toHaveBeenCalledTimes(1);
        });
    });
});
