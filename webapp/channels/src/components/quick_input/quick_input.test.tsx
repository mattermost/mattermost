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

        expect(screen.queryByTestId('input-clear')).not.toBeInTheDocument();
    });

    describe('should render clear button', () => {
        test('with default tooltip text', () => {
            renderWithContext(
                <QuickInput
                    value='mock'
                    clearable={true}
                    onClear={() => {}}
                />,
            );

            expect(screen.queryByTestId('input-clear')).toBeInTheDocument();
        });

        test('with customized tooltip text', () => {
            renderWithContext(
                <QuickInput
                    value='mock'
                    clearable={true}
                    clearableTooltipText='Custom'
                    onClear={() => {}}
                />,
            );

            expect(screen.queryByTestId('input-clear')).toBeInTheDocument();
        });

        test('with customized tooltip component', () => {
            renderWithContext(
                <QuickInput
                    value='mock'
                    clearable={true}
                    clearableTooltipText={
                        <span>{'Custom'}</span>
                    }
                    onClear={() => {}}
                />,
            );

            expect(screen.queryByTestId('input-clear')).toBeInTheDocument();
        });
    });

    test('should dismiss clear button', () => {
        const focusFn = jest.fn();
        class MockComp extends React.PureComponent {
            focus = focusFn;
            render() {
                return <div/>;
            }
        }
        const {rerender} = renderWithContext(
            <QuickInput
                value='mock'
                clearable={true}
                onClear={() => {}}
                inputComponent={MockComp}
            />,
        );

        expect(screen.queryByTestId('input-clear')).toBeInTheDocument();

        userEvent.click(screen.getByTestId('input-clear'));

        rerender(
            <QuickInput
                value=''
                clearable={true}
                onClear={() => {}}
                inputComponent={MockComp}
            />,
        );

        expect(screen.queryByTestId('input-clear')).not.toBeInTheDocument();
        expect(focusFn).toBeCalled();
    });
});
