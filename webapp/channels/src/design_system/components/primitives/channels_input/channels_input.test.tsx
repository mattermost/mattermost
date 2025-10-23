// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import ChannelsInput from './channels_input';

describe('components/widgets/inputs/ChannelsInput', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelsInput
                placeholder='test'
                ariaLabel='test'
                onChange={jest.fn()}
                channelsLoader={jest.fn()}
                onInputChange={jest.fn()}
                inputValue=''
                value={[
                    {
                        id: 'test-channel-1',
                        type: 'O',
                        display_name: 'test channel 1',
                    } as Channel,
                    {
                        id: 'test-channel-2',
                        type: 'P',
                        display_name: 'test channel 2',
                    } as Channel,
                ]}
            />,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <ForwardRef
              aria-label="test"
              className="ChannelsInput empty"
              classNamePrefix="channels-input"
              components={
                Object {
                  "IndicatorsContainer": [Function],
                  "MultiValueRemove": [Function],
                  "NoOptionsMessage": [Function],
                }
              }
              defaultMenuIsOpen={false}
              defaultOptions={false}
              formatOptionLabel={[Function]}
              getOptionValue={[Function]}
              inputValue=""
              isClearable={false}
              isMulti={true}
              loadOptions={[Function]}
              loadingMessage={[Function]}
              onChange={[Function]}
              onFocus={[Function]}
              onInputChange={[Function]}
              openMenuOnClick={false}
              openMenuOnFocus={true}
              placeholder="test"
              tabSelectsValue={true}
              value={
                Array [
                  Object {
                    "display_name": "test channel 1",
                    "id": "test-channel-1",
                    "type": "O",
                  },
                  Object {
                    "display_name": "test channel 2",
                    "id": "test-channel-2",
                    "type": "P",
                  },
                ]
              }
            />
        `);
    });
});
