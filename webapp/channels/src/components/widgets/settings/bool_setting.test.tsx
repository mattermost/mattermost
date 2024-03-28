// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BoolSetting from './bool_setting';

describe('components/widgets/settings/BoolSetting', () => {
    test('render component with required props', () => {
        const onChange = jest.fn();
        const wrapper = shallow(

            <BoolSetting
                id='string.id'
                label='some label'
                value={true}
                placeholder='Text aligned with checkbox'
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
    className="checkbox"
  >
    <label>
      <input
        checked={true}
        id="string.id"
        onChange={[Function]}
        type="checkbox"
      />
      <span>
        Text aligned with checkbox
      </span>
    </label>
  </div>
</Setting>
`);
    });

    test('onChange', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <BoolSetting
                id='string.id'
                label='some label'
                value={true}
                placeholder='Text aligned with checkbox'
                onChange={onChange}
            />,
        );

        wrapper.find('input').simulate('change', {target: {checked: true}});

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', true);
    });
});
