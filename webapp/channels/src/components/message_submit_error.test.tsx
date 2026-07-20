// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import MessageSubmitError from './message_submit_error';

describe('components/MessageSubmitError', () => {
    const baseProps = {
        handleSubmit: jest.fn(),
    };

    it('should display the submit link if the error is for an invalid slash command', () => {
        const error = {
            message: 'No command found',
            server_error_id: 'api.command.execute_command.not_found.app_error',
        };
        const submittedMessage = 'fakecommand some text';

        const props = {
            ...baseProps,
            error,
            submittedMessage,
        };

        renderWithContext(
            <MessageSubmitError {...props}/>,
        );

        expect(screen.getByText(/Command with a trigger of/)).toBeInTheDocument();
        expect(screen.getByText('Click here to send as a message.')).toBeInTheDocument();
        expect(screen.queryByText('No command found')).not.toBeInTheDocument();
    });

    it('should not display the submit link if the error is not for an invalid slash command', () => {
        const error = {
            message: 'Some server error',
            server_error_id: 'api.other_error',
        };
        const submittedMessage = '/fakecommand some text';

        const props = {
            ...baseProps,
            error,
            submittedMessage,
        };

        renderWithContext(
            <MessageSubmitError {...props}/>,
        );

        expect(screen.queryByText('Click here to send as a message.')).not.toBeInTheDocument();
        expect(screen.getByText('Some server error')).toBeInTheDocument();
    });
});
