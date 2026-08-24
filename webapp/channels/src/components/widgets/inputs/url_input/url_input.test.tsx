// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import URLInput from './url_input';

const baseProps = {
    base: 'http://localhost:8065',
    path: 'test-team/channels',
    pathInfo: 'test-channel',
};

describe('URLInput', () => {
    test('should reveal the editable input when Edit is clicked', async () => {
        const onChange = jest.fn();

        renderWithContext(
            <URLInput
                {...baseProps}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('urlInputLabel')).toHaveTextContent('http://localhost:8065/test-team/channels/test-channel');
        expect(screen.queryByTestId('channelURLInput')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        const urlInput = screen.getByTestId('channelURLInput');
        expect(urlInput).toHaveValue('test-channel');

        // The path moves out of the label and into the input while editing.
        expect(screen.getByTestId('urlInputLabel')).toHaveTextContent('URL: http://localhost:8065/test-team/channels/');
        expect(screen.getByTestId('urlInputLabel')).not.toHaveTextContent('test-channel');

        await userEvent.type(urlInput, 'x');
        expect(onChange).toHaveBeenCalled();
    });

    test('should reveal the editable input and disable the toggle when there is an error', () => {
        renderWithContext(
            <URLInput
                {...baseProps}
                error='URL is already taken'
            />,
        );

        expect(screen.getByTestId('channelURLInput')).toBeVisible();
        expect(screen.getByRole('alert')).toHaveTextContent('URL is already taken');
        expect(screen.getByRole('button', {name: 'Done'})).toBeDisabled();
    });

    describe('readOnly', () => {
        test('should not render the Edit button or the editable input', () => {
            renderWithContext(
                <URLInput
                    {...baseProps}
                    readOnly={true}
                />,
            );

            expect(screen.getByTestId('urlInputLabel')).toHaveTextContent('http://localhost:8065/test-team/channels/test-channel');
            expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
            expect(screen.queryByTestId('channelURLInput')).not.toBeInTheDocument();
        });

        test('should keep the editable input hidden even when an error is reported', () => {
            renderWithContext(
                <URLInput
                    {...baseProps}
                    readOnly={true}
                    error='Channel names must have maximum 64 characters.'
                />,
            );

            expect(screen.queryByTestId('channelURLInput')).not.toBeInTheDocument();
            expect(screen.getByRole('alert')).toHaveTextContent('Channel names must have maximum 64 characters.');
        });
    });

    describe('helpText', () => {
        test('should render the help text when provided', () => {
            renderWithContext(
                <URLInput
                    {...baseProps}
                    helpText='This URL cannot be changed.'
                />,
            );

            expect(screen.getByText('This URL cannot be changed.')).toBeVisible();
        });

        test('should not render help text when it is not provided', () => {
            renderWithContext(<URLInput {...baseProps}/>);

            expect(document.querySelector('.url-input-help-text')).not.toBeInTheDocument();
        });
    });
});
