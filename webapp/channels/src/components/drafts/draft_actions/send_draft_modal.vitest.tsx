// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import SendDraftModal from './send_draft_modal';

describe('components/drafts/draft_actions/send_draft_modal', () => {
    const baseProps = {
        displayName: 'display_name',
        onConfirm: vi.fn(),
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(
            <SendDraftModal
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have called onConfirm', () => {
        const onConfirm = vi.fn();
        renderWithIntl(
            <SendDraftModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        const confirmButton = screen.getByRole('button', {name: /yes, send now/i});
        fireEvent.click(confirmButton);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
