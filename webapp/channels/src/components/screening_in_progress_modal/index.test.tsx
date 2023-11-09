// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as controlModalHooks from 'components/common/hooks/useControlModal';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ScreeningInProgressModal from './';

describe('ScreeningInProgressModal', () => {
    it('informs customer that the subscription is under review', () => {
        renderWithContext(<ScreeningInProgressModal/>);
        screen.getByText('Your transaction is being reviewed');
    });

    it('closes the modal on click', () => {
        const mockClose = jest.fn();
        jest.spyOn(controlModalHooks, 'useControlScreeningInProgressModal').mockImplementation(() => ({close: mockClose, open: jest.fn()}));

        renderWithContext(<ScreeningInProgressModal/>);
        screen.getAllByText('Close')[1].click();
        expect(mockClose).toHaveBeenCalled();
    });
});
