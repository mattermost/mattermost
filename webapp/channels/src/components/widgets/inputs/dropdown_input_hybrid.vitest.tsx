// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import DropdownInputHybrid from './dropdown_input_hybrid';

describe('components/widgets/inputs/DropdownInputHybrid', () => {
    test('should match snapshot', () => {
        const {container} = render(
            <DropdownInputHybrid
                onDropdownChange={vi.fn()}
                onInputChange={vi.fn()}
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
        expect(container).toMatchSnapshot();
    });
});
