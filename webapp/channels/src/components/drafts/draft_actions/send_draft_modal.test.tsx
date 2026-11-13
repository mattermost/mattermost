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

import SendDraftModal from './send_draft_modal';

describe('components/drafts/draft_actions/send_draft_modal', () => {
    const baseProps = {
        displayName: 'display_name',
        onConfirm: jest.fn(),
        onExited: jest.fn(),
    };

    it('should have called onConfirm', async () => {
        renderWithContext(
            <SendDraftModal {...baseProps}/>,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: /yes, send now/i}));
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should have called onExited', async () => {
        renderWithContext(
            <SendDraftModal {...baseProps}/>,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'onExited'}));
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
