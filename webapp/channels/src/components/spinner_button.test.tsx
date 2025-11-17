// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SpinnerButton from 'components/spinner_button';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen, userEvent} from 'tests/react_testing_utils';

describe('components/SpinnerButton', () => {
    test('should render button when not spinning', () => {
        render(
            withIntl(
                <SpinnerButton
                    spinning={false}
                    spinningText='Test'
                >
                    {'Click me'}
                </SpinnerButton>,
            ),
        );

        const button = screen.getByRole('button', {name: 'Click me'});
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
    });

    test('should show spinning text when spinning', () => {
        render(
            withIntl(
                <SpinnerButton
                    spinning={true}
                    spinningText='Loading...'
                />,
            ),
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should render button with children', () => {
        render(
            withIntl(
                <SpinnerButton
                    spinning={false}
                    spinningText='Test'
                >
                    <span>{'Save'}</span>
                    <span>{'Changes'}</span>
                </SpinnerButton>,
            ),
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Changes')).toBeInTheDocument();
    });

    test('should call onClick when clicked', async () => {
        const onClick = jest.fn();

        render(
            withIntl(
                <SpinnerButton
                    spinning={false}
                    onClick={onClick}
                    spinningText='Test'
                >
                    {'Click me'}
                </SpinnerButton>,
            ),
        );

        const button = screen.getByRole('button', {name: 'Click me'});
        await userEvent.click(button);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should have id and custom classes when provided', () => {
        render(
            withIntl(
                <SpinnerButton
                    id='my-button-id'
                    className='btn btn-success'
                    spinningText='Test'
                    spinning={false}
                >
                    {'Submit'}
                </SpinnerButton>,
            ),
        );

        const button = screen.getByRole('button', {name: 'Submit'});
        expect(button).toHaveAttribute('id', 'my-button-id');
        expect(button).toHaveClass('btn');
        expect(button).toHaveClass('btn-success');
    });
});
