// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import type {MultiValue, MultiValueProps, OptionProps} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {Channel, ChannelWithTeamData} from '@mattermost/types/channels';

import {debounce} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import ChannelIcon from 'components/channel_type_icon/channel_icon';
import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';

import './channel_multiselector.scss';

type ChannelOption = {
    label: string;
    value: string;
    raw?: Channel;

    // True when the channel's details could not be fetched. The id is still carried through
    // onChange so saving never silently drops it.
    unresolved?: boolean;
};

type Props = {
    id: string;
    channelIds: string[];
    onChange: (channelIds: string[]) => void;
    disabled?: boolean;
    hasError?: boolean;
};

// channelLabel renders "Channel Name (Team Name)" so both the dropdown option and the
// selected pill show the channel together with the team it belongs to.
function channelLabel(channel: Channel, teamDisplayName?: string): string {
    return teamDisplayName ? `${channel.display_name} (${teamDisplayName})` : channel.display_name;
}

function Remove(props: React.ComponentProps<'div'>) {
    return (
        <div
            className='Remove'
            {...props}
        >
            <CloseCircleSolidIcon/>
        </div>
    );
}

function ChannelSelectorPill(props: MultiValueProps<ChannelOption, true>) {
    const {data, innerProps, removeProps} = props;

    return (
        <div
            className={classNames('ChannelSelectorPill', {unresolved: data.unresolved})}
            {...innerProps}
        >
            <ChannelIcon
                channel={data.raw}
                size={16}
            />
            {data.label}
            <Remove {...removeProps}/>
        </div>
    );
}

function ChannelSelectorOption(props: OptionProps<ChannelOption, true>) {
    const {data, innerProps} = props;

    return (
        <div
            className='ChannelSelectorOption'
            {...innerProps}
        >
            <ChannelIcon
                channel={data.raw}
                size={16}
            />
            {data.label}
        </div>
    );
}

export default function ChannelMultiSelector({id, channelIds, onChange, disabled = false, hasError = false}: Props) {
    const {formatMessage} = useIntl();

    const [optionsById, setOptionsById] = useState<Record<string, ChannelOption>>({});
    const requestedIds = useRef<Set<string>>(new Set());
    const teamNames = useRef<Record<string, string>>({});
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        const missing = channelIds.filter((channelId) => !requestedIds.current.has(channelId));
        if (missing.length === 0) {
            return;
        }
        missing.forEach((channelId) => requestedIds.current.add(channelId));

        const resolve = async () => {
            const channelResults = await Promise.allSettled(missing.map((channelId) => Client4.getChannel(channelId)));

            const channels: Channel[] = [];
            const failedIds: string[] = [];
            channelResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    channels.push(result.value);
                } else {
                    failedIds.push(missing[index]);
                }
            });

            const teamIds = [...new Set(channels.map((c) => c.team_id).filter(Boolean))].
                filter((teamId) => !teamNames.current[teamId]);
            const teamResults = await Promise.allSettled(teamIds.map((teamId) => Client4.getTeam(teamId)));
            teamResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    teamNames.current[result.value.id] = result.value.display_name;
                }
            });

            if (!mounted.current) {
                return;
            }

            setOptionsById((prev) => {
                const next = {...prev};
                channels.forEach((c) => {
                    next[c.id] = {
                        value: c.id,
                        label: channelLabel(c, teamNames.current[c.team_id]),
                        raw: c,
                    };
                });
                failedIds.forEach((channelId) => {
                    next[channelId] = {
                        value: channelId,
                        label: formatMessage(
                            {
                                id: 'admin.dataSpillage.deliveryTracking.channelSelector.unknownChannel',
                                defaultMessage: 'Unknown channel ({channelId})',
                            },
                            {channelId},
                        ),
                        unresolved: true,
                    };
                });
                return next;
            });
        };

        resolve();
    }, [channelIds, formatMessage]);

    const value = useMemo(
        () => channelIds.map((channelId) => optionsById[channelId]).filter(Boolean),
        [channelIds, optionsById],
    );

    const loadOptions = useMemo(() => debounce(async (term: string, callback: (options: ChannelOption[]) => void) => {
        try {
            const channels = await Client4.searchAllChannels(term, {exclude_default_channels: false}) as ChannelWithTeamData[];
            callback(channels.map((c) => ({
                value: c.id,
                label: channelLabel(c, c.team_display_name),
                raw: c,
            })));
        } catch {
            callback([]);
        }
    }, 200), []);

    const handleChange = useCallback((selected: MultiValue<ChannelOption>) => {
        const options = selected as ChannelOption[];

        setOptionsById((prev) => {
            const next = {...prev};
            options.forEach((option) => {
                next[option.value] = option;
            });
            return next;
        });
        options.forEach((option) => requestedIds.current.add(option.value));

        const selectedIds = options.map((option) => option.value);
        const pending = channelIds.filter((channelId) => !optionsById[channelId] && !selectedIds.includes(channelId));

        onChange([...selectedIds, ...pending]);
    }, [channelIds, optionsById, onChange]);

    const noChannelsMessage = useCallback((input: {inputValue: string}) => {
        // Don't show "No channels found" before the admin has typed anything.
        if (!input.inputValue || input.inputValue.trim() === '') {
            return null;
        }
        return formatMessage({id: 'admin.dataSpillage.deliveryTracking.channelSelector.noChannels', defaultMessage: 'No channels found'});
    }, [formatMessage]);

    const placeholder = formatMessage({id: 'admin.dataSpillage.deliveryTracking.channelSelector.placeholder', defaultMessage: 'Add channels...'});

    return (
        <div className={classNames('DeliveryTrackingChannelSelector', {error: hasError})}>
            <AsyncSelect<ChannelOption, true>
                id={id}
                inputId={`${id}_input`}
                classNamePrefix='DeliveryTrackingChannelSelector'
                className='Input Input__focus'
                isMulti={true}
                isClearable={false}
                hideSelectedOptions={true}
                cacheOptions={true}
                value={value}
                loadOptions={loadOptions}
                onChange={handleChange}
                placeholder={placeholder}
                noOptionsMessage={noChannelsMessage}
                isDisabled={disabled}
                menuPlacement='top'
                menuPortalTarget={document.body}
                components={{
                    DropdownIndicator: () => null,
                    IndicatorSeparator: () => null,
                    Option: ChannelSelectorOption,
                    MultiValue: ChannelSelectorPill,
                }}
            />
        </div>
    );
}
