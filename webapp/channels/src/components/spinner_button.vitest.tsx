// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SpinnerButton from 'components/spinner_button';

import {render, screen, fireEvent} from 'tests/vitest_react_testing_utils';

describe('components/SpinnerButton', () => {
    test('should match snapshot with required props', () => {
        const {container} = render(
            <SpinnerButton
                spinning={false}
                spinningText='Test'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with spinning', () => {
        const {container} = render(
            <SpinnerButton
                spinning={true}
                spinningText='Test'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const {container} = render(
            <SpinnerButton
                spinning={false}
                spinningText='Test'
            >
                <span id='child1'/>
                <span id='child2'/>
            </SpinnerButton>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should handle onClick', () => {
        const onClick = vi.fn();

        render(
            <SpinnerButton
                spinning={false}
                onClick={onClick}
                spinningText='Test'
            />,
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should add properties to underlying button', () => {
        render(
            <SpinnerButton
                id='my-button-id'
                className='btn btn-success'
                spinningText='Test'
                spinning={false}
            />,
        );

        const button = screen.getByRole('button');

        expect(button).toBeInTheDocument();
        expect(button.tagName).toEqual('BUTTON');
        expect(button.id).toEqual('my-button-id');
        expect(button).toHaveClass('btn');
        expect(button).toHaveClass('btn-success');
    });
});
