// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

import ManageAutoResponder from './manage_auto_responder';

describe('components/user_settings/notifications/ManageAutoResponder', () => {
    const requiredProps: ComponentProps<typeof ManageAutoResponder> = {
        autoResponderActive: false,
        autoResponderMessage: 'Hello World!',
        updateSection: vi.fn(),
        setParentState: vi.fn(),
        submit: vi.fn(),
        saving: false,
        error: '',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        const setParentState = vi.fn();
        const {container} = renderWithContext(
            <ManageAutoResponder
                {...requiredProps}
                autoResponderActive={true}
                setParentState={setParentState}
            />,
        );

        const checkbox = container.querySelector('#autoResponderActive') as HTMLInputElement;
        const textarea = container.querySelector('#autoResponderMessageInput') as HTMLTextAreaElement;

        expect(checkbox).toBeInTheDocument();
        expect(textarea).toBeInTheDocument();

        // Change the textarea
        fireEvent.change(textarea, {target: {value: 'New message'}});
        expect(setParentState).toHaveBeenCalledWith('autoResponderMessage', 'New message');

        // Change the checkbox
        fireEvent.click(checkbox);
        expect(setParentState).toHaveBeenCalled();
    });
});
