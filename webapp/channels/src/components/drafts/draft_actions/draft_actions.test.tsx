// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import DraftActions from './draft_actions';

jest.mock('components/with_tooltip', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
        <div data-testid='with-tooltip'>{children}</div>
    ),
}));

describe('components/drafts/draft_actions', () => {
    const baseProps = {
        displayName: '',
        draftId: '',
        itemId: '',
        onDelete: jest.fn(),
        onEdit: jest.fn(),
        onSend: jest.fn(),
        canSend: true,
        canEdit: true,
        onSchedule: jest.fn(),
        channelId: '',
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <DraftActions
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
