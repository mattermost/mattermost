// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {QuickInput} from './quick_input';

describe('components/QuickInput', () => {
    test.each([
        ['in default state', {}],
        ['when not clearable', {value: 'value', clearable: false, onClear: () => {}}],
        ['when no onClear callback', {value: 'value', clearable: true}],
        ['when value undefined', {clearable: true, onClear: () => {}}],
        ['when value empty', {value: '', clearable: true, onClear: () => {}}],
    ])('should not render clear button', (description, props) => {
        renderWithContext(
            <QuickInput {...props}/>,
        );

        expect(screen.queryByTestId('quick-input-clear')).not.toBeInTheDocument();
    });

    describe('should render clear button', () => {
        test('with default tooltip text', async () => {
            renderWithContext(
                <QuickInput
                    value='mock'
                    clearable={true}
                    onClear={() => {}}
                />,
            );

            expect(screen.queryByText('Clear')).not.toBeInTheDocument();

            userEvent.hover(screen.getByTestId('quick-input-clear'));

            expect(await screen.findByText('Clear')).toBeVisible();
        });

        test('with customized tooltip text', async () => {
            renderWithContext(
                <QuickInput
                    value='mock'
                    clearable={true}
                    clearableTooltipText='Custom text'
                    onClear={() => {}}
                />,
            );

            expect(screen.queryByText('Custom text')).not.toBeInTheDocument();

            userEvent.hover(screen.getByTestId('quick-input-clear'));

            expect(await screen.findByText('Custom text')).toBeVisible();
        });

        test('with customized tooltip component', async () => {
            renderWithContext(
                <QuickInput
                    value='mock'
                    clearable={true}
                    clearableTooltipText={
                        <span>{'Custom component'}</span>
                    }
                    onClear={() => {}}
                />,
            );

            expect(screen.queryByText('Custom component')).not.toBeInTheDocument();

            userEvent.hover(screen.getByTestId('quick-input-clear'));

            expect(await screen.findByText('Custom component')).toBeVisible();
        });
    });

    test('should dismiss clear button', () => {
        const handleClear = jest.fn();
        const focusFn = jest.fn();

        const MockComp = React.forwardRef((props: {defaultValue?: string}, ref: React.Ref<HTMLInputElement>) => (
            <input
                ref={ref}
                defaultValue={props.defaultValue}
                onFocus={focusFn}
            />
        ));

        const {rerender} = renderWithContext(
            <QuickInput
                value='mock'
                clearable={true}
                onClear={handleClear}
                inputComponent={MockComp}
            />,
        );

        expect(screen.queryByTestId('quick-input-clear')).toBeVisible();

        userEvent.click(screen.getByTestId('quick-input-clear'));

        expect(focusFn).toHaveBeenCalled();
        expect(handleClear).toHaveBeenCalled();

        rerender(
            <QuickInput
                value=''
                clearable={true}
                onClear={handleClear}
                inputComponent={MockComp}
            />,
        );

        expect(screen.queryByTestId('quick-input-clear')).not.toBeInTheDocument();
    });
});
