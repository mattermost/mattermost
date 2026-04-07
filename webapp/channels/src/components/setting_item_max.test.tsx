// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SettingItemMax from 'components/setting_item_max';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

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

    test('should match snapshot', async () => {
        const {asFragment} = await renderWithContext(<SettingItemMax {...baseProps}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot, without submit', async () => {
        const props = {...baseProps, submit: null};
        const {asFragment} = await renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot, on clientError', async () => {
        const props = {...baseProps, clientError: 'clientError'};
        const {asFragment} = await renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', async () => {
        const props = {...baseProps, serverError: 'serverError'};
        const {asFragment} = await renderWithContext(<SettingItemMax {...props}/>);

        expect(asFragment()).toMatchSnapshot();
    });

    test('should have called updateSection on handleUpdateSection with section after clicking cancel button', async () => {
        const {getByTestId} = await renderWithContext(<SettingItemMax {...baseProps}/>);

        await userEvent.click(getByTestId('cancelButton'));

        expect(baseProps.updateSection).toHaveBeenCalled();
        expect(baseProps.updateSection).toHaveBeenCalledWith(baseProps.section);
    });

    test('should have called submit on handleSubmit with setting after clicking save button', async () => {
        const {getByTestId} = await renderWithContext(<SettingItemMax {...baseProps}/>);

        await userEvent.click(getByTestId('saveSetting'));

        expect(baseProps.submit).toHaveBeenCalled();
        expect(baseProps.submit).toHaveBeenCalledWith(baseProps.setting);
    });

    test('should match snapshot, with new saveTextButton', async () => {
        const props = {...baseProps, saveButtonText: 'CustomText'};
        const {asFragment} = await renderWithContext(<SettingItemMax {...props}/>);

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

        const {getByRole, getByTestId} = await renderWithContext(<SettingItemMax {...props}/>);

        await userEvent.click(getByTestId('select'));

        await userEvent.keyboard('{enter}');
        expect(baseProps.submit).toHaveBeenCalledTimes(0);

        await userEvent.click(getByRole('radio'));

        await userEvent.keyboard('{enter}');
        expect(baseProps.submit).toHaveBeenCalledTimes(1);
    });
});
