// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import MessageSubmitError from 'components/message_submit_error';

import {renderWithIntl, screen} from 'tests/vitest_react_testing_utils';

describe('components/MessageSubmitError', () => {
    const baseProps = {
        handleSubmit: vi.fn(),
    };

    test('should display the submit link if the error is for an invalid slash command', () => {
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

        renderWithIntl(
            <MessageSubmitError {...props}/>,
        );

        // Check that the invalid command message is shown
        expect(screen.getByText(/Command with a trigger of/)).toBeInTheDocument();
        expect(screen.getByText(/Click here to send as a message/)).toBeInTheDocument();

        // Should not show the raw error message
        expect(screen.queryByText('No command found')).not.toBeInTheDocument();
    });

    test('should not display the submit link if the error is not for an invalid slash command', () => {
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

        renderWithIntl(
            <MessageSubmitError {...props}/>,
        );

        // Should not show the invalid command message
        expect(screen.queryByText(/Command with a trigger of/)).not.toBeInTheDocument();

        // Should show the raw error message
        expect(screen.getByText('Some server error')).toBeInTheDocument();
    });
});
