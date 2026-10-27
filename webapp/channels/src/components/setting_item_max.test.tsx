// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Combobox} from '@mattermost/compass-ui/components/combobox';

import SettingItemMax from 'components/setting_item_max';

import {installA11yFocusShim} from 'tests/helpers/a11y_focus_shim';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {A11yCustomEventTypes} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';

describe('components/SettingItemMax', () => {
    const baseProps = {
        inputs: ['input_1'],
        clientError: '',
        serverError: '',
        infoPosition: 'bottom',
        section: 'section',
        updateSection: jest.fn(),
        setting: 'setting',
        submit: jest.fn(),
        saving: false,
        title: 'title',
        width: 'full',
    };

    test('should match snapshot', () => {
        const {asFragment} = renderWithContext(<SettingItemMax {...baseProps}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot, without submit', () => {
        const props = {...baseProps, submit: null};
        const {asFragment} = renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot, on clientError', () => {
        const props = {...baseProps, clientError: 'clientError'};
        const {asFragment} = renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', () => {
        const props = {...baseProps, serverError: 'serverError'};
        const {asFragment} = renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should have called updateSection on handleUpdateSection with section after clicking cancel button', async () => {
        const {getByTestId} = renderWithContext(<SettingItemMax {...baseProps}/>);

        await userEvent.click(getByTestId('cancelButton'));

        expect(baseProps.updateSection).toHaveBeenCalled();
        expect(baseProps.updateSection).toHaveBeenCalledWith(baseProps.section);
    });

    test('should have called submit on handleSubmit with setting after clicking save button', async () => {
        const {getByTestId} = renderWithContext(<SettingItemMax {...baseProps}/>);

        await userEvent.click(getByTestId('saveSetting'));

        expect(baseProps.submit).toHaveBeenCalled();
        expect(baseProps.submit).toHaveBeenCalledWith(baseProps.setting);
    });

    test('should match snapshot, with new saveTextButton', () => {
        const props = {...baseProps, saveButtonText: 'CustomText'};
        const {asFragment} = renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should have called submit on handleSubmit onKeyDown ENTER', async () => {
        const props = {
            ...baseProps,
            inputs: [
                <select
                    key={0}
                    data-testid='select'
                />,
                <input
                    key={1}
                    type='radio'
                />,
            ],
        };

        const {getByRole, getByTestId} = renderWithContext(<SettingItemMax {...props}/>);

        await userEvent.click(getByTestId('select'));

        await userEvent.keyboard('{enter}');
        expect(baseProps.submit).toHaveBeenCalledTimes(0);

        await userEvent.click(getByRole('radio'));

        await userEvent.keyboard('{enter}');
        expect(baseProps.submit).toHaveBeenCalledTimes(1);
    });

    test('should focus react-select-like tabindex control on mount, not Save/Cancel', () => {
        const focusListener = jest.fn();
        document.addEventListener(A11yCustomEventTypes.FOCUS, focusListener);

        const props = {
            ...baseProps,
            inputs: (
                <div
                    data-testid='react-select-control'
                    role='combobox'
                    tabIndex={0}
                />
            ),
        };

        renderWithContext(<SettingItemMax {...props}/>);

        expect(focusListener).toHaveBeenCalled();
        const focusEvent = focusListener.mock.calls[0][0] as CustomEvent<A11yFocusEventDetail>;
        expect(focusEvent.detail.target).toHaveAttribute('data-testid', 'react-select-control');

        document.removeEventListener(A11yCustomEventTypes.FOCUS, focusListener);
    });

    test('should prefer checked radio over tabindex control on mount', () => {
        const focusListener = jest.fn();
        document.addEventListener(A11yCustomEventTypes.FOCUS, focusListener);

        const props = {
            ...baseProps,
            inputs: (
                <>
                    <input
                        data-testid='checked-radio'
                        type='radio'
                        defaultChecked={true}
                    />
                    <div
                        data-testid='tabindex-control'
                        tabIndex={0}
                    />
                </>
            ),
        };

        renderWithContext(<SettingItemMax {...props}/>);

        expect(focusListener).toHaveBeenCalled();
        const focusEvent = focusListener.mock.calls[0][0] as CustomEvent<A11yFocusEventDetail>;
        expect(focusEvent.detail.target).toHaveAttribute('data-testid', 'checked-radio');

        document.removeEventListener(A11yCustomEventTypes.FOCUS, focusListener);
    });

    describe('initial focus', () => {
        installA11yFocusShim();

        const options = [
            {value: 'a', label: 'Alpha'},
            {value: 'b', label: 'Bravo'},
            {value: 'c', label: 'Charlie'},
        ];

        const getSettingList = () => document.querySelector('.setting-list');

        const expectClosed = (combobox: HTMLElement) => {
            expect(combobox).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryAllByRole('option')).toHaveLength(0);
        };

        test('should focus the setting list, not an empty single Combobox input, and keep its menu closed', () => {
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            value=''
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            const input = screen.getByRole('combobox', {name: 'Attr'});
            expect(getSettingList()).toHaveFocus();
            expect(input).not.toHaveFocus();
            expectClosed(input);
        });

        test('should not focus the clear button of a single Combobox with a value', () => {
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            value='b'
                            clearable={true}
                            clearButtonProps={{'data-testid': 'attr-clear'}}
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            expect(getSettingList()).toHaveFocus();
            expect(screen.getByTestId('attr-clear')).not.toHaveFocus();
            expectClosed(screen.getByRole('combobox', {name: 'Attr'}));
        });

        test('should not focus a chip or its remove button of a multiple Combobox', () => {
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            multiple={true}
                            value={['a', 'b']}
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            const chips = document.querySelectorAll('[data-chip]');
            expect(chips).toHaveLength(2);
            expect(chips[0]).toHaveAttribute('tabindex', '0');
            expect(document.querySelectorAll('[data-chip] button').length).toBeGreaterThan(0);

            expect(getSettingList()).toHaveFocus();
            expect(document.activeElement?.closest('[data-chip]')).toBeNull();
            expectClosed(screen.getByRole('combobox', {name: 'Attr'}));
        });

        test('should open the Combobox menu only once the user clicks the input', async () => {
            const user = userEvent.setup();
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            value=''
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            const input = screen.getByRole('combobox', {name: 'Attr'});
            expectClosed(input);

            await user.click(input);

            expect(input).toHaveFocus();
            expect(input).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getAllByRole('option')).toHaveLength(3);
        });

        test('should submit on Enter right after expanding a Combobox-only section', async () => {
            const user = userEvent.setup();
            const submit = jest.fn();
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    submit={submit}
                    inputs={[
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            value='b'
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            await user.keyboard('{Enter}');

            expect(submit).toHaveBeenCalledTimes(1);
            expect(submit).toHaveBeenCalledWith(baseProps.setting);
        });

        test('should keep DOM order, focusing a form-control input placed before a Combobox', () => {
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <input
                            key='text'
                            className='form-control'
                            aria-label='Text'
                        />,
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            value=''
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            expect(screen.getByRole('textbox', {name: 'Text'})).toHaveFocus();
            expectClosed(screen.getByRole('combobox', {name: 'Attr'}));
        });

        test('should skip a Combobox and focus a form-control input placed after it', () => {
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            multiple={true}
                            value={['a']}
                            onChange={jest.fn()}
                        />,
                        <input
                            key='text'
                            className='form-control'
                            aria-label='Text'
                        />,
                    ]}
                />,
            );

            expect(screen.getByRole('textbox', {name: 'Text'})).toHaveFocus();
            expectClosed(screen.getByRole('combobox', {name: 'Attr'}));
        });

        test('should focus a button placed before a Combobox rather than the Combobox input', () => {
            renderWithContext(
                <SettingItemMax
                    {...baseProps}
                    inputs={[
                        <button key='button'>
                            {'Pick'}
                        </button>,
                        <Combobox
                            key='combobox'
                            aria-label='Attr'
                            options={options}
                            multiple={true}
                            value={['a']}
                            onChange={jest.fn()}
                        />,
                    ]}
                />,
            );

            expect(screen.getByRole('button', {name: 'Pick'})).toHaveFocus();
            expectClosed(screen.getByRole('combobox', {name: 'Attr'}));
        });
    });
});
