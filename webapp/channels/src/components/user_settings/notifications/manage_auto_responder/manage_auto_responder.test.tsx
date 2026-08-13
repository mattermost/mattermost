// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, fireEvent} from 'tests/react_testing_utils';

import ManageAutoResponder from './manage_auto_responder';

describe('components/user_settings/notifications/ManageAutoResponder', () => {
    const requiredProps: ComponentProps<typeof ManageAutoResponder> = {
        autoResponderActive: false,
        autoResponderMessage: 'Hello World!',
        updateSection: jest.fn(),
        setParentState: jest.fn(),
        submit: jest.fn(),
        saving: false,
        error: '',
    };

    test('should match snapshot, default disabled', () => {
        const {container} = renderWithContext(<ManageAutoResponder {...requiredProps}/>);

        expect(container).toMatchSnapshot();

        expect(container.querySelector('#autoResponderActive')).toBeInTheDocument();
        expect(container.querySelector('#autoResponderMessage')).not.toBeInTheDocument();
    });

    test('should match snapshot, enabled', () => {
        const {container} = renderWithContext(
            <ManageAutoResponder
                {...requiredProps}
                autoResponderActive={true}
            />,
        );

        expect(container).toMatchSnapshot();

        expect(container.querySelector('#autoResponderActive')).toBeInTheDocument();
        expect(container.querySelector('#autoResponderMessage')).toBeInTheDocument();
    });

    test('should pass handleChange', () => {
        const setParentState = jest.fn();
        const {container} = renderWithContext(
            <ManageAutoResponder
                {...requiredProps}
                autoResponderActive={true}
                setParentState={setParentState}
            />,
        );

        expect(container.querySelector('#autoResponderActive')).toBeInTheDocument();
        const textarea = container.querySelector('textarea#autoResponderMessageInput');
        expect(textarea).toBeInTheDocument();

        fireEvent.change(textarea!, {target: {value: 'Updated message'}});
        expect(setParentState).toHaveBeenCalled();
        expect(setParentState).toHaveBeenCalledWith('autoResponderMessage', 'Updated message');

        fireEvent.change(container.querySelector('#autoResponderActive')!, {target: {checked: true}});
        expect(setParentState).toHaveBeenCalled();
    });
});
