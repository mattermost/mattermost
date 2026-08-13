// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

jest.mock('@mattermost/components', () => ({
    GenericModal: ({
        children,
        handleConfirm,
        onExited,
        confirmButtonText,
        modalHeaderText,
    }: {
        children: React.ReactNode;
        handleConfirm?: () => void;
        onExited?: () => void;
        confirmButtonText?: string;
        modalHeaderText?: string;
    }) => (
        <div>
            <h1>{modalHeaderText}</h1>
            <div>{children}</div>
            <button onClick={handleConfirm}>{confirmButtonText || 'Confirm'}</button>
            <button onClick={onExited}>{'onExited'}</button>
        </div>
    ),
}));

import DeleteDraftModal from './delete_draft_modal';

describe('components/drafts/draft_actions/delete_draft_modal', () => {
    const baseProps = {
        displayName: 'display_name',
        onConfirm: jest.fn(),
        onExited: jest.fn(),
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <DeleteDraftModal
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should have called onConfirm', async () => {
        const {container} = renderWithContext(
            <DeleteDraftModal {...baseProps}/>,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: /yes, delete/i}));
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(container).toMatchSnapshot();
    });

    it('should have called onExited', async () => {
        const {container} = renderWithContext(
            <DeleteDraftModal {...baseProps}/>,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'onExited'}));
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
        expect(container).toMatchSnapshot();
    });
});
