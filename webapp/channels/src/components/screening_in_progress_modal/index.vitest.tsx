// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import * as controlModalHooks from 'components/common/hooks/useControlModal';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import ScreeningInProgressModal from './';

describe('ScreeningInProgressModal', () => {
    test('informs customer that the subscription is under review', () => {
        renderWithContext(<ScreeningInProgressModal/>);
        screen.getByText('Your transaction is being reviewed');
    });

    test('closes the modal on click', async () => {
        const mockClose = vi.fn();
        vi.spyOn(controlModalHooks, 'useControlScreeningInProgressModal').mockImplementation(() => ({close: mockClose, open: vi.fn()}));

        renderWithContext(<ScreeningInProgressModal/>);
        await userEvent.click(screen.getAllByText('Close')[1]);
        expect(mockClose).toHaveBeenCalled();
    });
});
