// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SettingItemMax from 'components/setting_item_max';

import {fireEvent, renderWithContext, userEvent} from 'tests/react_testing_utils';

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

    test('should have called updateSection on handleUpdateSection with section after clicking cancel button', () => {
        const {getByTestId} = renderWithContext(<SettingItemMax {...baseProps}/>);

        userEvent.click(getByTestId('cancelButton'));

        expect(baseProps.updateSection).toHaveBeenCalled();
        expect(baseProps.updateSection).toHaveBeenCalledWith(baseProps.section);
    });

    test('should have called submit on handleSubmit with setting after clicking save button', () => {
        const {getByTestId} = renderWithContext(<SettingItemMax {...baseProps}/>);

        userEvent.click(getByTestId('saveSetting'));

        expect(baseProps.submit).toHaveBeenCalled();
        expect(baseProps.submit).toHaveBeenCalledWith(baseProps.setting);
    });

    test('should match snapshot, with new saveTextButton', () => {
        const props = {...baseProps, saveButtonText: 'CustomText'};
        const {asFragment} = renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should have called submit on handleSubmit onKeyDown ENTER', () => {
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

        getByTestId('select').focus();

        /**
         * RTL recommends to use this approach to test keydown events.
         * https://testing-library.com/docs/guide-events/#keydown
         */
        fireEvent.keyDown(document.activeElement!, {key: 'Enter', code: 'Enter'});
        expect(baseProps.submit).toHaveBeenCalledTimes(0);

        getByRole('radio').focus();

        fireEvent.keyDown(document.activeElement!, {key: 'Enter', code: 'Enter'});
        expect(baseProps.submit).toHaveBeenCalledTimes(1);
    });
});
