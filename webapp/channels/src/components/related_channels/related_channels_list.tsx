// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import type {ChannelRelationship} from '@mattermost/types/channel_relationships';

import {fetchChannelRelationships} from 'mattermost-redux/actions/channel_relationships';
import {getChannelRelationships} from 'mattermost-redux/selectors/entities/channel_relationships';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const ChannelItem = styled.button`
    display: flex;
    align-items: center;
    padding: 6px 8px;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    width: 100%;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const ChannelIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.64);

    i {
        font-size: 16px;
    }
`;

const ChannelName = styled.div`
    flex: 1;
    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--center-channel-color-rgb));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const EmptyState = styled.div`
    padding: 12px 8px;
    text-align: center;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    line-height: 20px;
`;

const LoadingContainer = styled.div`
    display: flex;
    justify-content: center;
    padding: 12px;
`;

type Props = {
    channelId: string;
};

const RelatedChannelsList: React.FC<Props> = ({channelId}) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();

    const relationships = useSelector((state: GlobalState) => getChannelRelationships(state, channelId));
    const currentTeamName = useSelector((state: GlobalState) => getCurrentTeam(state)?.name ?? '');
    const [loading, setLoading] = React.useState(true);

    useEffect(() => {
        setLoading(true);
        dispatch(fetchChannelRelationships(channelId)).finally(() => {
            setLoading(false);
        });
    }, [dispatch, channelId]);

    // Get the "other" channel ID from a relationship (the one that isn't the current channel)
    const getRelatedChannelId = (rel: ChannelRelationship): string | null => {
        if (rel.source_channel_id === channelId) {
            return rel.target_channel_id === channelId ? null : rel.target_channel_id;
        }
        return rel.source_channel_id === channelId ? null : rel.source_channel_id;
    };

    // Flatten relationships, filtering out self-references and deduplicating by channel
    const relatedChannels = useMemo(() => {
        const seen = new Set<string>();
        const result: Array<{rel: ChannelRelationship; relatedChannelId: string}> = [];

        Object.values(relationships).forEach((rel) => {
            const relatedChannelId = getRelatedChannelId(rel);
            // Skip self-references and duplicates
            if (!relatedChannelId || seen.has(relatedChannelId)) {
                return;
            }
            seen.add(relatedChannelId);
            result.push({rel, relatedChannelId});
        });

        return result;
    }, [relationships, channelId]);

    const handleChannelClick = (targetChannelId: string, targetChannelName: string) => {
        history.push(`/${currentTeamName}/channels/${targetChannelName}`);
    };

    if (loading) {
        return (
            <LoadingContainer>
                <LoadingSpinner/>
            </LoadingContainer>
        );
    }

    if (relatedChannels.length === 0) {
        return (
            <EmptyState>
                {formatMessage({
                    id: 'channel_info_rhs.related_channels.empty',
                    defaultMessage: 'No related channels',
                })}
            </EmptyState>
        );
    }

    return (
        <Container>
            {relatedChannels.map(({rel, relatedChannelId}) => (
                <ChannelItemComponent
                    key={rel.id}
                    targetChannelId={relatedChannelId}
                    onClick={handleChannelClick}
                />
            ))}
        </Container>
    );
};

type ChannelItemProps = {
    targetChannelId: string;
    onClick: (targetChannelId: string, targetChannelName: string) => void;
};

const ChannelItemComponent: React.FC<ChannelItemProps> = ({
    targetChannelId,
    onClick,
}) => {
    const channel = useSelector((state: GlobalState) => getChannel(state, targetChannelId));

    if (!channel) {
        return null;
    }

    const getChannelIcon = () => {
        switch (channel.type) {
        case Constants.OPEN_CHANNEL:
            return <i className='icon icon-globe'/>;
        case Constants.PRIVATE_CHANNEL:
            return <i className='icon icon-lock-outline'/>;
        case Constants.DM_CHANNEL:
            return <i className='icon icon-account-outline'/>;
        case Constants.GM_CHANNEL:
            return <i className='icon icon-account-multiple-outline'/>;
        default:
            return <i className='icon icon-globe'/>;
        }
    };

    return (
        <ChannelItem
            onClick={() => onClick(targetChannelId, channel.name)}
            aria-label={channel.display_name}
        >
            <ChannelIcon>
                {getChannelIcon()}
            </ChannelIcon>
            <ChannelName>
                {channel.display_name}
            </ChannelName>
        </ChannelItem>
    );
};

export default RelatedChannelsList;
