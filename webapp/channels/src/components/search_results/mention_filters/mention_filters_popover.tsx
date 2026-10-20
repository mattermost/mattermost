// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {ChevronDownIcon, MagnifyIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentLocale} from 'selectors/i18n';

import ChannelTypeIcon from 'components/channel_type_icon';

import {Preferences} from 'utils/constants';
import {dateRangeOrder, defaultMentionFilters, mentionTypeOrder} from 'utils/mention_search';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import type {GlobalState} from 'types/store';
import type {MentionDateRange, MentionFilters, MentionType} from 'types/store/rhs';

import {dateRangeLabels, mentionTypeLabels} from './labels';
import useFilterableChannels, {useTeamNames} from './use_filterable_channels';

type Props = {
    filters: MentionFilters;
    teamId: string | null;
    showTeamSelector: boolean;
    onApply: (filters: MentionFilters, teamId: string | null) => void;
    onClose: () => void;
};

type ExpandedSection = 'team' | 'channels' | null;

// The selectors are expanded in place rather than opening their own menus: a menu inside the popover
// would be dismissed along with it on the click that opens the menu.
export default function MentionFiltersPopover({filters, teamId, showTeamSelector, onApply, onClose}: Props) {
    const {formatMessage} = useIntl();

    const [draft, setDraft] = useState<MentionFilters>(filters);
    const [draftTeamId, setDraftTeamId] = useState<string | null>(teamId);
    const [expanded, setExpanded] = useState<ExpandedSection>(null);
    const [channelFilter, setChannelFilter] = useState('');

    const myTeams = useSelector(getMyTeams);
    const locale = useSelector(getCurrentLocale);
    const teamsOrder = useSelector((state: GlobalState) => get(state, Preferences.TEAMS_ORDER, '', ''));
    const channels = useFilterableChannels(draftTeamId);
    const teamNames = useTeamNames();

    const teams = useMemo(
        () => filterAndSortTeamsByDisplayName(myTeams, locale, teamsOrder),
        [myTeams, locale, teamsOrder],
    );

    const allTeamsLabel = formatMessage({id: 'search_results.mention_filters.all_teams', defaultMessage: 'All teams'});
    const selectedTeamName = teams.find((team) => team.id === draftTeamId)?.display_name ?? allTeamsLabel;

    const matchingChannels = useMemo(() => {
        const term = channelFilter.trim().toLowerCase();
        if (!term) {
            return channels;
        }
        return channels.filter((channel) =>
            channel.display_name.toLowerCase().includes(term) || channel.name.toLowerCase().includes(term));
    }, [channels, channelFilter]);

    const selectedChannels = useMemo(
        () => channels.filter((channel) => draft.channelIds.includes(channel.id)),
        [channels, draft.channelIds],
    );

    // Without a team selected the list spans teams, where a channel name on its own can be ambiguous.
    const showChannelTeam = draftTeamId === null;

    const channelsLabel = selectedChannels.length > 0 ? selectedChannels.map((channel) => channel.display_name).join(', ') : '';

    const toggleSection = (section: ExpandedSection) => {
        setExpanded((current) => (current === section ? null : section));
        setChannelFilter('');
    };

    const selectTeam = (nextTeamId: string | null) => {
        setDraftTeamId(nextTeamId);

        // The selected channels belong to the team being left, so they can't carry over.
        setDraft((current) => ({...current, channelIds: []}));
        setExpanded(null);
    };

    const toggleChannel = (channel: Channel) => {
        setDraft((current) => ({
            ...current,
            channelIds: current.channelIds.includes(channel.id) ? current.channelIds.filter((id) => id !== channel.id) : [...current.channelIds, channel.id],
        }));
    };

    const toggleMentionType = (type: MentionType) => {
        setDraft((current) => ({
            ...current,
            mentionTypes: current.mentionTypes.includes(type) ? current.mentionTypes.filter((t) => t !== type) : [...current.mentionTypes, type],
        }));
    };

    const selectDate = (date: MentionDateRange) => {
        setDraft((current) => ({...current, date}));
    };

    const reset = () => {
        setDraft(defaultMentionFilters);
        setDraftTeamId(null);
        setExpanded(null);
    };

    const apply = () => {
        onApply(draft, draftTeamId);
        onClose();
    };

    const isReset = draftTeamId === null && draft.channelIds.length === 0 && draft.mentionTypes.length === 0 && draft.date === 'any';

    return (
        <div className='MentionFilters__popover'>
            <div className='MentionFilters__selectors'>
                {showTeamSelector && (
                    <div className='MentionFilters__field'>
                        <button
                            type='button'
                            id='mentionFiltersTeamSelector'
                            data-testid='mentionFiltersTeamSelector'
                            className={classNames('MentionFilters__fieldButton', {'MentionFilters__fieldButton--open': expanded === 'team'})}
                            aria-expanded={expanded === 'team'}
                            onClick={() => toggleSection('team')}
                        >
                            <span className='MentionFilters__fieldLabel'>
                                <FormattedMessage
                                    id='search_results.mention_filters.team'
                                    defaultMessage='Team'
                                />
                            </span>
                            <span className='MentionFilters__fieldValue'>{selectedTeamName}</span>
                            <ChevronDownIcon size={16}/>
                        </button>
                        {expanded === 'team' && (
                            <ul className='MentionFilters__options'>
                                <li>
                                    <button
                                        type='button'
                                        className='MentionFilters__option'
                                        role='menuitemradio'
                                        aria-checked={draftTeamId === null}
                                        onClick={() => selectTeam(null)}
                                    >
                                        <span className='MentionFilters__optionLabel'>{allTeamsLabel}</span>
                                        {draftTeamId === null && <i className='icon icon-check'/>}
                                    </button>
                                </li>
                                {teams.map((team) => (
                                    <li key={team.id}>
                                        <button
                                            type='button'
                                            className='MentionFilters__option'
                                            role='menuitemradio'
                                            aria-checked={draftTeamId === team.id}
                                            onClick={() => selectTeam(team.id)}
                                        >
                                            <span className='MentionFilters__optionLabel'>{team.display_name}</span>
                                            {draftTeamId === team.id && <i className='icon icon-check'/>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div className='MentionFilters__field'>
                    <button
                        type='button'
                        id='mentionFiltersChannelSelector'
                        data-testid='mentionFiltersChannelSelector'
                        className={classNames('MentionFilters__fieldButton', {'MentionFilters__fieldButton--open': expanded === 'channels'})}
                        aria-expanded={expanded === 'channels'}
                        onClick={() => toggleSection('channels')}
                    >
                        {channelsLabel ? (
                            <>
                                <span className='MentionFilters__fieldLabel'>
                                    <FormattedMessage
                                        id='search_results.mention_filters.channels'
                                        defaultMessage='Channel or Direct Messages'
                                    />
                                </span>
                                <span className='MentionFilters__fieldValue'>{channelsLabel}</span>
                            </>
                        ) : (
                            <span className='MentionFilters__fieldPlaceholder'>
                                <FormattedMessage
                                    id='search_results.mention_filters.channels'
                                    defaultMessage='Channel or Direct Messages'
                                />
                            </span>
                        )}
                        <ChevronDownIcon size={16}/>
                    </button>
                    {expanded === 'channels' && (
                        <div className='MentionFilters__channelPicker'>
                            <div className='MentionFilters__search'>
                                <MagnifyIcon size={16}/>
                                <input
                                    type='text'
                                    autoFocus={true}
                                    value={channelFilter}
                                    onChange={(e) => setChannelFilter(e.target.value)}
                                    placeholder={formatMessage({id: 'search_results.mention_filters.search_channels', defaultMessage: 'Search channels'})}
                                    aria-label={formatMessage({id: 'search_results.mention_filters.search_channels', defaultMessage: 'Search channels'})}
                                />
                            </div>
                            <ul className='MentionFilters__options'>
                                {matchingChannels.map((channel) => (
                                    <li key={channel.id}>
                                        <label className='MentionFilters__option MentionFilters__option--checkbox'>
                                            <input
                                                type='checkbox'
                                                checked={draft.channelIds.includes(channel.id)}
                                                onChange={() => toggleChannel(channel)}
                                            />
                                            <ChannelTypeIcon channel={channel}/>
                                            <span className='MentionFilters__optionLabel'>{channel.display_name}</span>
                                            {showChannelTeam && channel.team_id && (
                                                <span className='MentionFilters__optionTeam'>{teamNames[channel.team_id]}</span>
                                            )}
                                        </label>
                                    </li>
                                ))}
                                {matchingChannels.length === 0 && (
                                    <li className='MentionFilters__noOptions'>
                                        <FormattedMessage
                                            id='search_results.mention_filters.no_channels'
                                            defaultMessage='No channels found'
                                        />
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <fieldset className='MentionFilters__section'>
                <legend className='MentionFilters__sectionTitle'>
                    <FormattedMessage
                        id='search_results.mention_filters.mention_type'
                        defaultMessage='Mention type'
                    />
                </legend>
                {mentionTypeOrder.map((type) => (
                    <label
                        key={type}
                        className='MentionFilters__choice'
                    >
                        <input
                            type='checkbox'
                            checked={draft.mentionTypes.includes(type)}
                            onChange={() => toggleMentionType(type)}
                        />
                        <span>{formatMessage(mentionTypeLabels[type])}</span>
                    </label>
                ))}
            </fieldset>

            <fieldset className='MentionFilters__section'>
                <legend className='MentionFilters__sectionTitle'>
                    <FormattedMessage
                        id='search_results.mention_filters.date'
                        defaultMessage='Date'
                    />
                </legend>
                {dateRangeOrder.map((range) => (
                    <label
                        key={range}
                        className='MentionFilters__choice'
                    >
                        <input
                            type='radio'
                            name='mentionFiltersDate'
                            checked={draft.date === range}
                            onChange={() => selectDate(range)}
                        />
                        <span>{formatMessage(dateRangeLabels[range])}</span>
                    </label>
                ))}
            </fieldset>

            <div className='MentionFilters__footer'>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    disabled={isReset}
                    onClick={reset}
                >
                    <FormattedMessage
                        id='search_results.mention_filters.reset'
                        defaultMessage='Reset'
                    />
                </button>
                <button
                    type='button'
                    className='btn btn-primary'
                    onClick={apply}
                >
                    <FormattedMessage
                        id='search_results.mention_filters.done'
                        defaultMessage='Done'
                    />
                </button>
            </div>
        </div>
    );
}
