// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SharedChannelsRemoveModal from './shared_channels_remove_modal';

describe('SharedChannelsRemoveModal', () => {
    const baseProps = {
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the title and subheader copy', () => {
        renderWithContext(<SharedChannelsRemoveModal {...baseProps}/>);

        expect(screen.getByText('Remove channel')).toBeInTheDocument();
        expect(screen.getByText('The channel will be removed from this connection and will no longer be shared with it.')).toBeInTheDocument();
    });

    it('calls onConfirm when the Remove button is clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(<SharedChannelsRemoveModal {...baseProps}/>);

        await user.click(screen.getByRole('button', {name: 'Remove'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when the cancel button is clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(<SharedChannelsRemoveModal {...baseProps}/>);

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.onCancel).toHaveBeenCalled();
    });

    it('does not throw when onCancel is omitted', async () => {
        const user = userEvent.setup();
        const props = {...baseProps, onCancel: undefined};

        renderWithContext(<SharedChannelsRemoveModal {...props}/>);

        await user.click(screen.getByRole('button', {name: 'Cancel'}));
    });
});
