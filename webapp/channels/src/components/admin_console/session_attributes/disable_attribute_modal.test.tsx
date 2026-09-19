// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import DisableAttributeModal from './disable_attribute_modal';

describe('DisableAttributeModal', () => {
    const baseProps = {
        attributeName: 'Client IP',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the destructive header and confirm button', () => {
        renderWithContext(<DisableAttributeModal {...baseProps}/>);

        expect(screen.getByText('Disable attribute')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Disable'})).toBeInTheDocument();
        expect(screen.getByText('Client IP')).toBeInTheDocument();
    });

    it('fires onConfirm when the confirm button is clicked', async () => {
        renderWithContext(<DisableAttributeModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('fires onCancel and onExited when cancelled', async () => {
        renderWithContext(<DisableAttributeModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalledTimes(1);
        });
    });
});
