// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {ChannelIntroButtonAction} from 'types/store/plugins';

import PluggableIntroButtons from './pluggable_intro_buttons';

describe('components/post_view/channel_intro_message/PluggableIntroButtons', () => {
    const channel = {id: 'channel_id', delete_at: 0} as Channel;
    const channelMember = {channel_id: 'channel_id', user_id: 'user_id'} as ChannelMembership;

    const makeButton = (id: string, text: string, action = jest.fn()) => ({
        id,
        pluginId: 'test-plugin',
        text,
        icon: <span data-testid={`${id}-icon`}/>,
        action,
    }) as unknown as ChannelIntroButtonAction;

    test('should render each plugin button with its label and icon', () => {
        renderWithContext(
            <PluggableIntroButtons
                channel={channel}
                channelMember={channelMember}
                pluginButtons={[
                    makeButton('one', 'Create a board'),
                    makeButton('two', 'Start a call'),
                ]}
            />,
        );

        expect(screen.getByRole('button', {name: 'Create a board'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Start a call'})).toBeInTheDocument();
        expect(screen.getByTestId('one-icon')).toBeInTheDocument();
        expect(screen.getByTestId('two-icon')).toBeInTheDocument();
    });

    test('should call the plugin action with the channel and member on click', async () => {
        const action = jest.fn();

        renderWithContext(
            <PluggableIntroButtons
                channel={channel}
                channelMember={channelMember}
                pluginButtons={[makeButton('one', 'Create a board', action)]}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Create a board'}));

        expect(action).toHaveBeenCalledWith(channel, channelMember);
    });

    test('should render nothing for an archived channel, without a membership, or with no buttons', () => {
        const buttons = [makeButton('one', 'Create a board')];

        const {container, rerender} = renderWithContext(
            <PluggableIntroButtons
                channel={{...channel, delete_at: 1}}
                channelMember={channelMember}
                pluginButtons={buttons}
            />,
        );
        expect(container).toBeEmptyDOMElement();

        rerender(
            <PluggableIntroButtons
                channel={channel}
                pluginButtons={buttons}
            />,
        );
        expect(container).toBeEmptyDOMElement();

        rerender(
            <PluggableIntroButtons
                channel={channel}
                channelMember={channelMember}
                pluginButtons={[]}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
