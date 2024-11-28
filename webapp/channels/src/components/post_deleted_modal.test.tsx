// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {renderWithIntl} from 'tests/react_testing_utils';
import PostDeletedModal from 'components/post_deleted_modal';

describe('components/PostDeletedModal', () => {
    const baseProps = {
        onExited: jest.fn(),
    };

    test('should render modal with expected content', () => {
        renderWithIntl(<PostDeletedModal {...baseProps}/>);

        // Verify modal title and content
        expect(screen.getByText('Comment could not be posted')).toBeInTheDocument();
        expect(screen.getByText('Someone deleted the message on which you tried to post a comment.')).toBeInTheDocument();
        
        // Verify OK button exists and is focused
        const okButton = screen.getByTestId('postDeletedModalOkButton');
        expect(okButton).toBeInTheDocument();
        expect(okButton).toHaveFocus();
    });

    test('should call onExited when clicking OK button', async () => {
        const {container} = renderWithIntl(<PostDeletedModal {...baseProps}/>);

        // Click OK button
        await userEvent.click(screen.getByTestId('postDeletedModalOkButton'));
        
        // Wait for modal to fade out
        await screen.findByRole('dialog', {hidden: true});
        
        // Remove the modal from the document to trigger onExited
        container.querySelector('.modal-backdrop')?.remove();
        container.querySelector('.modal')?.remove();
        
        // Verify onExited was called
        expect(baseProps.onExited).toHaveBeenCalled();
    });
});
