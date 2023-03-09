// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AdminTextSetting from './text_setting';

describe('components/admin_console/TextSetting', () => {
    test('render component with required props', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <AdminTextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
                setByEnv={false}
                labelClassName=''
                inputClassName=''
                maxLength={-1}
                resizable={true}
                type='input'
            />,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <TextSetting
              disabled={false}
              id="string.id"
              inputClassName="col-sm-8"
              label="some label"
              labelClassName="col-sm-4"
              maxLength={-1}
              onChange={[MockFunction]}
              resizable={true}
              type="input"
              value="some value"
            />
        `);
    });
});
