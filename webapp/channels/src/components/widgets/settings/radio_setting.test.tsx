// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import RadioSetting from './radio_setting';

describe('components/widgets/settings/RadioSetting', () => {
    test('render component with required props', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <RadioSetting
                id='string.id'
                label='some label'
                options={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
            />,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <Setting
              inputClassName=""
              inputId="string.id"
              label="some label"
              labelClassName=""
            >
              <RadioInput
                checked={false}
                dataTestId="Engineering"
                handleChange={[Function]}
                id="Engineering"
                key="Engineering"
                name="string.id"
                title="this is engineering"
                value="Engineering"
              />
              <RadioInput
                checked={true}
                dataTestId="Sales"
                handleChange={[Function]}
                id="Sales"
                key="Sales"
                name="string.id"
                title="this is sales"
                value="Sales"
              />
              <RadioInput
                checked={false}
                dataTestId="Administration"
                handleChange={[Function]}
                id="Administration"
                key="Administration"
                name="string.id"
                title="this is administration"
                value="Administration"
              />
            </Setting>
        `);
    });

    test('onChange', () => {
        const onChange = jest.fn();
        const wrapper = renderWithContext(
            <RadioSetting
                id='string.id'
                label='some label'
                options={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
            />,
        );

        wrapper.debug();

        wrapper.getByTestId('Administration').click();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'Administration');
    });
});
