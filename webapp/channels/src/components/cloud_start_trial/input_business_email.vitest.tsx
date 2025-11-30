// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {ItemStatus} from 'utils/constants';

import InputBusinessEmail from './input_business_email';

describe('/components/cloud_start_trial/input_business_email', () => {
    const handleEmailValuesMockFn = vi.fn();
    const baseProps = {
        handleEmailValues: handleEmailValuesMockFn,
        email: 'foo@example.com',
        customInputLabel: null,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<InputBusinessEmail {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('test input business email displays the input element correctly', () => {
        const {container} = renderWithContext(<InputBusinessEmail {...baseProps}/>);
        const inputElement = container.querySelector('.Input');
        expect(inputElement).toBeInTheDocument();
    });

    test('test input business email displays the SUCCESS custom message correctly', () => {
        const {container} = renderWithContext(
            <InputBusinessEmail {...{...baseProps, customInputLabel: {type: ItemStatus.SUCCESS, value: 'success value'}}}/>,
        );
        const customMessageElement = container.querySelector('.Input___customMessage.Input___success');
        expect(customMessageElement).toBeInTheDocument();
    });

    test('test input business email displays the WARNING custom message correctly', () => {
        const {container} = renderWithContext(
            <InputBusinessEmail {...{...baseProps, customInputLabel: {type: ItemStatus.WARNING, value: 'warning value'}}}/>,
        );
        const customMessageElement = container.querySelector('.Input___customMessage.Input___warning');
        expect(customMessageElement).toBeInTheDocument();
    });

    test('test input business email displays the ERROR custom message correctly', () => {
        const {container} = renderWithContext(
            <InputBusinessEmail {...{...baseProps, customInputLabel: {type: ItemStatus.ERROR, value: 'error value'}}}/>,
        );
        const customMessageElement = container.querySelector('.Input___customMessage.Input___error');
        expect(customMessageElement).toBeInTheDocument();
    });

    test('test input business email displays the INFO custom message correctly', () => {
        const {container} = renderWithContext(
            <InputBusinessEmail {...{...baseProps, customInputLabel: {type: ItemStatus.INFO, value: 'info value'}}}/>,
        );
        const customMessageElement = container.querySelector('.Input___customMessage.Input___info');
        expect(customMessageElement).toBeInTheDocument();
    });

    test('test the input element handles the onChange event correctly', () => {
        renderWithContext(<InputBusinessEmail {...baseProps}/>);
        const inputElement = screen.getByRole('textbox');

        fireEvent.change(inputElement, {target: {value: 'email@domain.com'}});
        expect(handleEmailValuesMockFn).toHaveBeenCalled();
    });
});
