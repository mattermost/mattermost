// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelsInput from './channels_input';

describe('components/widgets/inputs/ChannelsInput', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
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

        expect(container).toMatchSnapshot();
    });
});
