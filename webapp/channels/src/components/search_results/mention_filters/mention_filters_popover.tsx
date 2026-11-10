// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';
import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';
import {Radio} from '@mattermost/compass-ui/components/radio';

import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {get, isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentLocale} from 'selectors/i18n';

import {Preferences, ZIndex} from 'utils/constants';
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

// Group mentions need a license, either for LDAP groups or for custom groups, so without one there are
// no group mention keys and the option would only ever narrow the results to nothing.
function areGroupMentionsAvailable(state: GlobalState) {
    const license = getLicense(state);
    return isCustomGroupsEnabled(state) || (license?.IsLicensed === 'true' && license?.LDAPGroups === 'true');
}

// Combobox rejects empty option values, so All teams needs a sentinel mapped to null.
const ALL_TEAMS_VALUE = 'all_teams';

export default function MentionFiltersPopover({filters, teamId, showTeamSelector, onApply, onClose}: Props) {
    const {formatMessage} = useIntl();
    const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

    const [draft, setDraft] = useState<MentionFilters>(filters);
    const [draftTeamId, setDraftTeamId] = useState<string | null>(teamId);

    const myTeams = useSelector(getMyTeams);
    const locale = useSelector(getCurrentLocale);
    const teamsOrder = useSelector((state: GlobalState) => get(state, Preferences.TEAMS_ORDER, '', ''));
    const groupMentionsAvailable = useSelector(areGroupMentionsAvailable);
    const channels = useFilterableChannels(draftTeamId);
    const teamNames = useTeamNames();

    const teams = useMemo(
        () => filterAndSortTeamsByDisplayName(myTeams, locale, teamsOrder),
        [myTeams, locale, teamsOrder],
    );

    const allTeamsLabel = formatMessage({id: 'search_results.mention_filters.all_teams', defaultMessage: 'All teams'});
    const teamLabel = formatMessage({id: 'search_results.mention_filters.team', defaultMessage: 'Team'});
    const channelsLabel = formatMessage({id: 'search_results.mention_filters.channels', defaultMessage: 'Channel or Direct Messages'});
    const noChannelsLabel = formatMessage({id: 'search_results.mention_filters.no_channels', defaultMessage: 'No channels found'});

    const teamOptions = useMemo<ComboboxOption[]>(() => [
        {value: ALL_TEAMS_VALUE, label: allTeamsLabel},
        ...teams.map((team) => ({value: team.id, label: team.display_name})),
    ], [allTeamsLabel, teams]);

    const channelOptions = useMemo<ComboboxOption[]>(() => channels.map((channel) => ({
        value: channel.id,
        label: channel.display_name,
        secondaryLabel: draftTeamId === null && channel.team_id ? teamNames[channel.team_id] : undefined,
    })), [channels, draftTeamId, teamNames]);

    const filterChannels = (option: ComboboxOption, query: string) => {
        const channel = channels.find((c) => c.id === option.value);
        if (!channel) {
            return false;
        }
        const term = query.trim().toLowerCase();
        if (!term) {
            return true;
        }
        return channel.display_name.toLowerCase().includes(term) || channel.name.toLowerCase().includes(term);
    };

    const selectTeam = (value: string | string[] | null) => {
        const nextValue = Array.isArray(value) ? value[0] ?? null : value;
        const nextTeamId = nextValue && nextValue !== ALL_TEAMS_VALUE ? nextValue : null;
        setDraftTeamId(nextTeamId);

        // The selected channels belong to the team being left, so they can't carry over.
        setDraft((current) => ({...current, channelIds: []}));
    };

    const selectChannels = (value: string | string[] | null) => {
        let channelIds: string[] = [];
        if (Array.isArray(value)) {
            channelIds = value;
        } else if (value) {
            channelIds = [value];
        }
        setDraft((current) => ({...current, channelIds}));
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
    };

    const apply = () => {
        onApply(draft, draftTeamId);
        onClose();
    };

    const isReset = draftTeamId === null && draft.channelIds.length === 0 && draft.mentionTypes.length === 0 && draft.date === 'any';

    return (
        <div
            ref={setPortalContainer}
            className='MentionFilters__popover'
        >
            <div className='MentionFilters__selectors'>
                {showTeamSelector && (
                    <div
                        className='MentionFilters__field'
                        data-testid='mentionFiltersTeamSelector'
                    >
                        <Combobox
                            label={teamLabel}
                            options={teamOptions}
                            value={draftTeamId ?? ALL_TEAMS_VALUE}
                            onChange={selectTeam}
                            portalContainer={portalContainer}
                            zIndex={ZIndex.POPOVER}
                        />
                    </div>
                )}

                <div
                    className='MentionFilters__field'
                    data-testid='mentionFiltersChannelSelector'
                >
                    <Combobox
                        multiple={true}
                        label={channelsLabel}
                        placeholder={channelsLabel}
                        options={channelOptions}
                        value={draft.channelIds}
                        onChange={selectChannels}
                        filter={filterChannels}
                        emptyMessage={noChannelsLabel}
                        menuItemProps={{secondaryLabelPosition: 'inline'}}
                        portalContainer={portalContainer}
                        zIndex={ZIndex.POPOVER}
                    />
                </div>
            </div>

            <fieldset className='MentionFilters__section'>
                <legend className='MentionFilters__sectionTitle'>
                    <FormattedMessage
                        id='search_results.mention_filters.mention_type'
                        defaultMessage='Mention type'
                    />
                </legend>
                <div className='MentionFilters__choices'>
                    {mentionTypeOrder.filter((type) => type !== 'group' || groupMentionsAvailable).map((type) => (
                        <Checkbox
                            key={type}
                            className='MentionFilters__choice'
                            checked={draft.mentionTypes.includes(type)}
                            onChange={() => toggleMentionType(type)}
                        >
                            {formatMessage(mentionTypeLabels[type])}
                        </Checkbox>
                    ))}
                </div>
            </fieldset>

            <fieldset className='MentionFilters__section'>
                <legend className='MentionFilters__sectionTitle'>
                    <FormattedMessage
                        id='search_results.mention_filters.date'
                        defaultMessage='Date'
                    />
                </legend>
                <div className='MentionFilters__choices'>
                    {dateRangeOrder.map((range) => (
                        <Radio
                            key={range}
                            className='MentionFilters__choice'
                            name='mentionFiltersDate'
                            checked={draft.date === range}
                            onChange={() => selectDate(range)}
                        >
                            {formatMessage(dateRangeLabels[range])}
                        </Radio>
                    ))}
                </div>
            </fieldset>

            <div className='MentionFilters__footer'>
                <Button
                    emphasis='tertiary'
                    disabled={isReset}
                    onClick={reset}
                >
                    <FormattedMessage
                        id='search_results.mention_filters.reset'
                        defaultMessage='Reset'
                    />
                </Button>
                <Button
                    emphasis='primary'
                    onClick={apply}
                >
                    <FormattedMessage
                        id='search_results.mention_filters.apply'
                        defaultMessage='Apply'
                    />
                </Button>
            </div>
        </div>
    );
}
