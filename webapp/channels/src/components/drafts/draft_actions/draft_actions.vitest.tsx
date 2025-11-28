// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import DraftActions from './draft_actions';

describe('components/drafts/draft_actions', () => {
    const baseProps = {
        displayName: '',
        draftId: '',
        itemId: '',
        onDelete: vi.fn(),
        onEdit: vi.fn(),
        onSend: vi.fn(),
        canSend: true,
        canEdit: true,
        onSchedule: vi.fn(),
        channelId: '',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <DraftActions
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
