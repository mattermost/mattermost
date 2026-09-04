// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AppliesToCard from './applies_to_card';
import {DEFAULT_CHANNEL_RESOURCE_CONFIG} from './channels';

describe('AppliesToCard', () => {
    it('starts with no resource and offers to add one', () => {
        renderWithContext(
            <AppliesToCard
                channelResource={null}
                onChannelResourceChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId('appliesToEmpty')).toBeInTheDocument();
        expect(screen.getByTestId('appliesToAddResource')).toBeInTheDocument();
        expect(screen.queryByTestId('channelsResourceRow')).not.toBeInTheDocument();
    });

    it('adds a Channels resource with the server defaults', async () => {
        const onChannelResourceChange = jest.fn();
        renderWithContext(
            <AppliesToCard
                channelResource={null}
                onChannelResourceChange={onChannelResourceChange}
            />,
        );

        await userEvent.click(screen.getByTestId('appliesToAddResource'));

        expect(onChannelResourceChange).toHaveBeenCalledWith(DEFAULT_CHANNEL_RESOURCE_CONFIG);
    });

    it('renders the row and hides Add resource once channels are covered', () => {
        renderWithContext(
            <AppliesToCard
                channelResource={DEFAULT_CHANNEL_RESOURCE_CONFIG}
                onChannelResourceChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId('channelsResourceRow')).toBeInTheDocument();

        // Channels is the only resource type this card offers.
        expect(screen.queryByTestId('appliesToAddResource')).not.toBeInTheDocument();
    });

    it('clears the resource when the row is removed', async () => {
        const onChannelResourceChange = jest.fn();
        renderWithContext(
            <AppliesToCard
                channelResource={DEFAULT_CHANNEL_RESOURCE_CONFIG}
                onChannelResourceChange={onChannelResourceChange}
            />,
        );

        await userEvent.click(screen.getByTestId('channelsResourceRowRemove'));

        expect(onChannelResourceChange).toHaveBeenCalledWith(null);
    });

    it('hands removal to the host when it has a saved field to delete', async () => {
        // Clearing the form is right while the resource is unsaved. A host editing an
        // attribute that already exists owns the removal instead, because it deletes a
        // field and the values on it.
        const onChannelResourceChange = jest.fn();
        const onChannelResourceRemove = jest.fn();
        renderWithContext(
            <AppliesToCard
                channelResource={DEFAULT_CHANNEL_RESOURCE_CONFIG}
                onChannelResourceChange={onChannelResourceChange}
                onChannelResourceRemove={onChannelResourceRemove}
            />,
        );

        await userEvent.click(screen.getByTestId('channelsResourceRowRemove'));

        expect(onChannelResourceRemove).toHaveBeenCalled();
        expect(onChannelResourceChange).not.toHaveBeenCalled();
    });

    it('does not offer to add a resource while disabled', async () => {
        const onChannelResourceChange = jest.fn();
        renderWithContext(
            <AppliesToCard
                channelResource={null}
                onChannelResourceChange={onChannelResourceChange}
                disabled={true}
            />,
        );

        await userEvent.click(screen.getByTestId('appliesToAddResource'));

        expect(onChannelResourceChange).not.toHaveBeenCalled();
    });
});
