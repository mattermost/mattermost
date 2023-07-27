// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {renderWithIntl, screen, fireEvent} from 'tests/react_testing_utils';

import CheckboxSetting from './checkbox_setting';

describe('components/admin_console/CheckboxSetting', () => {
    test('should match snapshot', () => {
        const onChange = jest.fn();
        const {container} = renderWithIntl(
            <CheckboxSetting
                id='string.id'
                label='some label'
                defaultChecked={false}
                onChange={onChange}
                setByEnv={false}
                disabled={false}
            />,
        );
        const checkbox: HTMLInputElement = screen.getByRole('checkbox');
        expect(checkbox).toBeVisible();
        expect(checkbox).toHaveProperty('type', 'checkbox');
        expect(container).toMatchSnapshot();
    });

    test('onChange', () => {
        const onChange = jest.fn();
        renderWithIntl(
            <CheckboxSetting
                id='string.id'
                label='some label'
                defaultChecked={false}
                onChange={onChange}
                setByEnv={false}
                disabled={false}
            />,
        );
        const checkbox: HTMLInputElement = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', true);
        expect(checkbox).toBeChecked();
    });
});
