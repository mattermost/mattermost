// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {PropertyValue} from '@mattermost/types/properties';

import type {ChannelFieldMetadata} from 'components/properties_card_view/properties_card_view';
import SidebarBaseChannelIcon from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon';

import './channel_property_renderer.scss';

type Props = {
    value: PropertyValue<unknown>;
    metadata?: ChannelFieldMetadata;
    testIdScope?: string;
};

export default function ChannelPropertyRenderer({value, metadata, testIdScope}: Props) {
    const channelId = value.value as string;
    const channel = metadata?.channel;

    return (
        <div
            className='ChannelPropertyRenderer'
            data-testid={testIdScope ? `${testIdScope}.channel` : undefined}
        >
            {
                channel &&
                (
                    <>
                        <SidebarBaseChannelIcon
                            channel={channel}
                        />
                        {channel.display_name}
                    </>
                )
            }

            {
                !channel &&
                <FormattedMessage
                    id='post_card.channel_property.deleted_channel'
                    defaultMessage='Deleted channel ID: {channelId}'
                    values={{channelId}}
                />
            }
        </div>
    );
}
