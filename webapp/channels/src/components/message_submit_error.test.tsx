// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import MessageSubmitError from 'components/message_submit_error';

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

        const wrapper = shallow(
            <MessageSubmitError {...props}/>,
        );

        expect(wrapper.find('[id="message_submit_error.invalidCommand"]').exists()).toBe(true);
        expect(wrapper.text()).not.toEqual('No command found');
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

        const wrapper = shallow(
            <MessageSubmitError {...props}/>,
        );

        expect(wrapper.find('[id="message_submit_error.invalidCommand"]').exists()).toBe(false);
        expect(wrapper.text()).toEqual('Some server error');
    });
});
