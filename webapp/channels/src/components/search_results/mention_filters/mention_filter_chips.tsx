// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CalendarOutlineIcon} from '@mattermost/compass-icons/components';
import {Chip} from '@mattermost/compass-ui/components/chip';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {updateMentionFilters} from 'actions/views/rhs';
import {getExplicitSearchTeam, getMentionFilters} from 'selectors/rhs';

import {mentionTypeOrder} from 'utils/mention_search';

import type {GlobalState} from 'types/store';
import type {MentionType} from 'types/store/rhs';

import {dateRangeLabels, mentionTypeLabels} from './labels';
import useFilterableChannels, {useTeamNames} from './use_filterable_channels';

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

    const removeLabel = (label: string) => formatMessage(
        {id: 'search_results.mention_filters.remove_filter', defaultMessage: 'Remove {filter} filter'},
        {filter: label},
    );

    return (
        <div
            className='MentionFilterChips'
            data-testid='mentionFilterChips'
        >
            {team && (
                <Chip
                    size='small'
                    aria-label={removeLabel(team.display_name)}
                    onRemove={removeTeam}
                >
                    {team.display_name}
                </Chip>
            )}
            {filters.channelIds.map((channelId) => {
                const label = channelLabel(channelId);
                return (
                    <Chip
                        key={channelId}
                        size='small'
                        aria-label={removeLabel(label)}
                        onRemove={() => removeChannel(channelId)}
                    >
                        {label}
                    </Chip>
                );
            })}
            {mentionTypeOrder.filter((type) => filters.mentionTypes.includes(type)).map((type) => {
                const label = formatMessage(mentionTypeLabels[type]);
                return (
                    <Chip
                        key={type}
                        size='small'
                        aria-label={removeLabel(label)}
                        onRemove={() => removeMentionType(type)}
                    >
                        {label}
                    </Chip>
                );
            })}
            {filters.date !== 'any' && (
                <Chip
                    size='small'
                    aria-label={removeLabel(formatMessage(dateRangeLabels[filters.date]))}
                    leadingIcon={<CalendarOutlineIcon/>}
                    onRemove={removeDate}
                >
                    {formatMessage(dateRangeLabels[filters.date])}
                </Chip>
            )}
        </div>
    );
}
