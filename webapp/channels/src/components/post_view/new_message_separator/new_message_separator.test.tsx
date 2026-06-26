// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {testPluginComponentErrorHandling} from 'tests/helpers/plugin_error_handling';
import {renderWithContext, screen} from 'tests/react_testing_utils';

import NewMessageSeparator from './new_message_separator';

describe('components/post_view/new_message_separator', () => {
    const baseProps = {
        separatorId: '1234',
        newMessagesSeparatorActions: [],
    };

    test('should render new_message_separator', () => {
        renderWithContext(
            <NewMessageSeparator
                {...baseProps}
            />,
        );

        const newMessage = screen.getByText('New Messages');
        const separator = screen.getByTestId('NotificationSeparator');

        expect(newMessage).toBeInTheDocument();
        expect(newMessage).toHaveClass('separator__text');

        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass('Separator NotificationSeparator');
    });

    testPluginComponentErrorHandling((pluginComponent) => {
        renderWithContext(
            <NewMessageSeparator
                {...baseProps}
                newMessagesSeparatorActions={[pluginComponent]}
            />,
        );
    });
});
