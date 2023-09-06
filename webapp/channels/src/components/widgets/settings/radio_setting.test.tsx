// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

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
  <div
    className="radio"
    key="Engineering"
  >
    <label>
      <input
        checked={false}
        name="string.id"
        onChange={[Function]}
        type="radio"
        value="Engineering"
      />
      this is engineering
    </label>
  </div>
  <div
    className="radio"
    key="Sales"
  >
    <label>
      <input
        checked={true}
        name="string.id"
        onChange={[Function]}
        type="radio"
        value="Sales"
      />
      this is sales
    </label>
  </div>
  <div
    className="radio"
    key="Administration"
  >
    <label>
      <input
        checked={false}
        name="string.id"
        onChange={[Function]}
        type="radio"
        value="Administration"
      />
      this is administration
    </label>
  </div>
</Setting>
`);
    });

    test('onChange', () => {
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

        wrapper.find('input').at(0).simulate('change', {target: {value: 'Administration'}});

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'Administration');
    });
});
