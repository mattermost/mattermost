// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import DropdownInputHybrid from './dropdown_input_hybrid';

describe('components/widgets/inputs/DropdownInputHybrid', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <DropdownInputHybrid
                onDropdownChange={jest.fn()}
                onInputChange={jest.fn()}
                value={{value: 'forever', label: 'Keep Forever'}}
                inputValue={''}
                width={90}
                exceptionToInput={['forever']}
                defaultValue={{value: 'forever', label: 'Keep Forever'}}
                options={[
                    {value: 'days', label: 'Days'},
                    {value: 'months', label: 'Months'},
                    {value: 'years', label: 'Years'},
                    {value: 'forever', label: 'Keep Forever'},
                ]}
                legend={'Channel Message Retention'}
                placeholder={'Channel Message Retention'}
                name={'channel_message_retention'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
