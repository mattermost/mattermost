// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import DeleteDraftModal from './delete_draft_modal';

describe('components/drafts/draft_actions/delete_draft_modal', () => {
    const baseProps = {
        displayName: 'display_name',
        onConfirm: vi.fn(),
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(
            <DeleteDraftModal
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have called onConfirm', () => {
        const onConfirm = vi.fn();
        renderWithIntl(
            <DeleteDraftModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        const confirmButton = screen.getByRole('button', {name: /yes, delete/i});
        fireEvent.click(confirmButton);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
