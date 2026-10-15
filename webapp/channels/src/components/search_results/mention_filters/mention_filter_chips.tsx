// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CalendarOutlineIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {updateMentionFilters} from 'actions/views/rhs';
import {getExplicitSearchTeam, getMentionFilters} from 'selectors/rhs';

import {mentionTypeOrder} from 'utils/mention_search';

import type {GlobalState} from 'types/store';
import type {MentionType} from 'types/store/rhs';

import {dateRangeLabels, mentionTypeLabels} from './labels';
import useFilterableChannels, {useTeamNames} from './use_filterable_channels';

type ChipProps = {
    label: string;
    onRemove: () => void;
    icon?: React.ReactNode;
};

function Chip({label, onRemove, icon}: ChipProps) {
    const {formatMessage} = useIntl();

    return (
        <span className='MentionFilterChip'>
            {icon}
            <span className='MentionFilterChip__label'>{label}</span>
            <button
                type='button'
                className='MentionFilterChip__remove'
                aria-label={formatMessage({id: 'search_results.mention_filters.remove_filter', defaultMessage: 'Remove {filter} filter'}, {filter: label})}
                onClick={onRemove}
            >
                <CloseCircleIcon size={14}/>
            </button>
        </span>
    );
}

// MentionFilterChips lists the filters currently narrowing the mentions panel, each removable on its
// own. It renders nothing when no filter is applied.
export default function MentionFilterChips() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const filters = useSelector(getMentionFilters);
    const teamId = useSelector(getExplicitSearchTeam);
    const team = useSelector((state: GlobalState) => (teamId ? getTeam(state, teamId) : undefined));
    const channels = useFilterableChannels(teamId);
    const teamNames = useTeamNames();

    // Dropping the team drops its channels with it, the same way picking a different team in the
    // popover does. The channels were chosen from the team being left.
    const removeTeam = useCallback(() => {
        dispatch(updateMentionFilters({...filters, channelIds: []}, null));
    }, [dispatch, filters]);

    const removeChannel = useCallback((channelId: string) => {
        dispatch(updateMentionFilters({...filters, channelIds: filters.channelIds.filter((id) => id !== channelId)}, teamId));
    }, [dispatch, filters, teamId]);

    const removeMentionType = useCallback((type: MentionType) => {
        dispatch(updateMentionFilters({...filters, mentionTypes: filters.mentionTypes.filter((t) => t !== type)}, teamId));
    }, [dispatch, filters, teamId]);

    const removeDate = useCallback(() => {
        dispatch(updateMentionFilters({...filters, date: 'any'}, teamId));
    }, [dispatch, filters, teamId]);

    const hasFilters = Boolean(teamId) || filters.channelIds.length > 0 || filters.mentionTypes.length > 0 || filters.date !== 'any';
    if (!hasFilters) {
        return null;
    }

    const channelLabel = (channelId: string) => {
        const channel = channels.find((c) => c.id === channelId);
        if (!channel) {
            return formatMessage({id: 'search_results.mention_filters.unknown_channel', defaultMessage: 'Channel'});
        }

        // Without a team filter the chips can span teams, where a channel name alone is ambiguous.
        if (!teamId && channel.team_id && teamNames[channel.team_id]) {
            return formatMessage(
                {id: 'search_results.mention_filters.channel_on_team', defaultMessage: '{channel} ({team})'},
                {channel: channel.display_name, team: teamNames[channel.team_id]},
            );
        }

        return channel.display_name;
    };

    return (
        <div
            className='MentionFilterChips'
            data-testid='mentionFilterChips'
        >
            {team && (
                <Chip
                    label={team.display_name}
                    onRemove={removeTeam}
                />
            )}
            {filters.channelIds.map((channelId) => (
                <Chip
                    key={channelId}
                    label={channelLabel(channelId)}
                    onRemove={() => removeChannel(channelId)}
                />
            ))}
            {mentionTypeOrder.filter((type) => filters.mentionTypes.includes(type)).map((type) => (
                <Chip
                    key={type}
                    label={formatMessage(mentionTypeLabels[type])}
                    onRemove={() => removeMentionType(type)}
                />
            ))}
            {filters.date !== 'any' && (
                <Chip
                    label={formatMessage(dateRangeLabels[filters.date])}
                    icon={<CalendarOutlineIcon size={14}/>}
                    onRemove={removeDate}
                />
            )}
        </div>
    );
}
