// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ChannelsInput from './channels_input';

const publicChannel = {
    id: 'test-channel-1',
    type: 'O',
    name: 'off-topic',
    display_name: 'Off-Topic',
} as Channel;

const privateChannel = {
    id: 'test-channel-2',
    type: 'P',
    name: 'offsite-planning',
    display_name: 'Offsite Planning',
} as Channel;

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
                value={[publicChannel, privateChannel]}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render each suggested channel with its display name and tilde-prefixed slug', async () => {
        renderWithContext(
            <ChannelsInput
                placeholder='test'
                ariaLabel='Search and Add Channels'
                onChange={jest.fn()}
                channelsLoader={() => Promise.resolve([publicChannel, privateChannel])}
                onInputChange={jest.fn()}
                inputValue='off'
                value={[]}
            />,
        );

        await userEvent.click(screen.getByLabelText('Search and Add Channels'));

        const options = await screen.findAllByRole('option');
        expect(options).toHaveLength(2);

        expect(options[0]).toHaveTextContent('Off-Topic~off-topic');
        expect(options[1]).toHaveTextContent('Offsite Planning~offsite-planning');
    });
});
