// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ScreeningInProgressModal from './';

// Mock the hook
jest.mock('components/common/hooks/useControlModal', () => ({
    ...jest.requireActual('components/common/hooks/useControlModal'),
    useControlScreeningInProgressModal: jest.fn(),
}));

import {useControlScreeningInProgressModal} from 'components/common/hooks/useControlModal';
const mockUseControlScreeningInProgressModal = useControlScreeningInProgressModal as jest.MockedFunction<typeof useControlScreeningInProgressModal>;

describe('ScreeningInProgressModal', () => {
    const mockClose = jest.fn();
    const mockOpen = jest.fn();

    beforeEach(() => {
        mockClose.mockClear();
        mockOpen.mockClear();
        mockUseControlScreeningInProgressModal.mockReturnValue({
            close: mockClose,
            open: mockOpen,
        });
    });

    it('informs customer that the subscription is under review', () => {
        renderWithContext(<ScreeningInProgressModal/>);
        screen.getByText('Your transaction is being reviewed');
    });

    it('closes the modal on click', async () => {
        renderWithContext(<ScreeningInProgressModal/>);
        await userEvent.click(screen.getAllByText('Close')[1]);
        expect(mockClose).toHaveBeenCalled();
    });
});
