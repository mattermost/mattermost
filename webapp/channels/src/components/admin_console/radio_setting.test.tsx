// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import RadioSetting from './radio_setting';

describe('components/admin_console/RadioSetting', () => {
    test('should match snapshot', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <RadioSetting
                id='string.id'
                label='some label'
                values={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
                setByEnv={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('onChange', () => {
        const onChange = jest.fn();
        const wrapper = renderWithContext(
            <RadioSetting
                id='string.id'
                label='some label'
                values={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
                setByEnv={false}
            />,
        );

        wrapper.getByTestId('Administration').click();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'Administration');
    });
});
