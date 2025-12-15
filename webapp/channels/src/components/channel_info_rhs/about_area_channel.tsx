// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';

import Markdown from 'components/markdown';

import EditableArea from './components/editable_area';
import LineLimiter from './components/linelimiter';

const ChannelName = styled.div`
    margin-bottom: 12px;
    font-size: 20px;
    font-family: Metropolis, sans-serif;
    font-weight: 600;
    letter-spacing: -0.01em;
`;

const ChannelId = styled.div`
    margin-bottom: 12px;
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.02em;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    &:not(:last-child) {
        margin-bottom: 4px;
    }
`;

const ChannelPurpose = styled.div`
    margin-bottom: 12px;
    &.ChannelPurpose--is-dm {
        margin-bottom: 16px;
    }
`;

const ChannelDescriptionHeading = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.75);
    font-size: 11px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
    letter-spacing: 0.24px;
    text-transform: uppercase;
    padding: 4px 0px;
`;

const ChannelHeader = styled.div`
    margin-bottom: 12px;
`;

interface Props {
    channel: Channel;
    canEditChannelProperties: boolean;
    actions: {
        editChannelName: () => void;
        editChannelPurpose: () => void;
        editChannelHeader: () => void;
    };
}

const AboutAreaChannel = ({channel, canEditChannelProperties, actions}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <>
            <ChannelName>
                <EditableArea
                    editable={canEditChannelProperties}
                    content={<div>{channel.display_name}</div>}
                    onEdit={actions.editChannelName}
                    editTooltip={formatMessage({id: 'channel_info_rhs.about_area.edit_channel_name', defaultMessage: 'Rename channel'})}
                    emptyLabel={formatMessage({id: 'channel_info_rhs.about_area.edit_channel_name', defaultMessage: 'Rename channel'})}
                />
            </ChannelName>

            {(channel.purpose || canEditChannelProperties) && (
                <ChannelPurpose>
                    <ChannelDescriptionHeading>
                        {formatMessage({id: 'channel_info_rhs.about_area.channel_purpose.heading', defaultMessage: 'Channel Purpose'})}
                    </ChannelDescriptionHeading>
                    <EditableArea
                        editable={canEditChannelProperties}
                        content={channel.purpose && (
                            <LineLimiter
                                maxLines={4}
                                lineHeight={20}
                                moreText={formatMessage({id: 'channel_info_rhs.about_area.channel_purpose.line_limiter.more', defaultMessage: 'more'})}
                                lessText={formatMessage({id: 'channel_info_rhs.about_area.channel_purpose.line_limiter.less', defaultMessage: 'less'})}
                            >
                                <Markdown message={channel.purpose}/>
                            </LineLimiter>
                        )}
                        onEdit={actions.editChannelPurpose}
                        editTooltip={formatMessage({id: 'channel_info_rhs.about_area.edit_channel_purpose', defaultMessage: 'Edit channel purpose'})}
                        emptyLabel={formatMessage({id: 'channel_info_rhs.about_area.add_channel_purpose', defaultMessage: 'Add a channel purpose'})}
                    />
                </ChannelPurpose>
            )}

            {(channel.header || canEditChannelProperties) && (
                <ChannelHeader>
                    <ChannelDescriptionHeading>
                        {formatMessage({id: 'channel_info_rhs.about_area.channel_header.heading', defaultMessage: 'Channel Header'})}
                    </ChannelDescriptionHeading>
                    <EditableArea
                        content={channel.header && (
                            <LineLimiter
                                maxLines={4}
                                lineHeight={20}
                                moreText={formatMessage({id: 'channel_info_rhs.about_area.channel_header.line_limiter.more', defaultMessage: 'more'})}
                                lessText={formatMessage({id: 'channel_info_rhs.about_area.channel_header.line_limiter.less', defaultMessage: 'less'})}
                            >
                                <Markdown message={channel.header}/>
                            </LineLimiter>
                        )}
                        editable={canEditChannelProperties}
                        onEdit={actions.editChannelHeader}
                        editTooltip={formatMessage({id: 'channel_info_rhs.about_area.edit_channel_header', defaultMessage: 'Edit channel header'})}
                        emptyLabel={formatMessage({id: 'channel_info_rhs.about_area.add_channel_header', defaultMessage: 'Add a channel header'})}
                    />
                </ChannelHeader>
            )}

            <ChannelId>
                {formatMessage({id: 'channel_info_rhs.about_area_handle', defaultMessage: 'Channel handle:'})} {channel.name}
            </ChannelId>
            <ChannelId>
                {formatMessage({id: 'channel_info_rhs.about_area_id', defaultMessage: 'ID:'})} {channel.id}
            </ChannelId>

        </>
    );
};

export default AboutAreaChannel;
