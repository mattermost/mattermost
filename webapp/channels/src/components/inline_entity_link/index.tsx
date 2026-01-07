// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent} from 'react';

import {LinkVariantIcon} from '@mattermost/compass-icons/components';

import {getChannelByNameAndTeamName} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getTeam, getTeamByName} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {loadIfNecessaryAndSwitchToChannelById, switchToChannel} from 'actions/views/channel';
import {switchTeam} from 'actions/team_actions';
import store from 'stores/redux_store';

import {focusPost} from 'components/permalink_view/actions';
import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';

type Props = {
    type: string;
    value: string;
    teamName?: string;
    channelName?: string;
    onClick?: (type: string, value: string) => void;
};

export default function InlineEntityLink({type, value, teamName, channelName, onClick}: Props) {
    const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onClick) {
            onClick(type, value);
            return;
        }

        const normalized = type.toUpperCase();
        const state = store.getState();
        const returnTo = getHistory().location?.pathname || '';

        switch (normalized) {
        case Constants.InlineEntityTypes.POST: {
            const currentUserId = getCurrentUserId(state);
            store.dispatch(focusPost(value, returnTo, currentUserId, {skipRedirectReplyPermalink: true}));
            break;
        }
        case Constants.InlineEntityTypes.CHANNEL: {
            // If we have a value (ID), use it directly
            if (value) {
                store.dispatch(loadIfNecessaryAndSwitchToChannelById(value));
            } else if (teamName && channelName) {
                // If we don't have an ID but have names (from parsed URL), look it up
                // We need to fetch the channel by name first
                store.dispatch(getChannelByNameAndTeamName(teamName, channelName)).then(({data: channel}) => {
                    if (channel) {
                        store.dispatch(switchToChannel(channel));
                    }
                });
            }
            break;
        }
        case Constants.InlineEntityTypes.TEAM: {
            if (value) {
                const team = getTeam(state, value) || getTeamByName(state, value);
                if (team) {
                    store.dispatch(selectTeam(team.id));
                    store.dispatch(switchTeam(`/${team.name}`));
                } else if (teamName) {
                    // Try to find by teamName if value lookup failed or wasn't an ID
                    const teamByName = getTeamByName(state, teamName);
                    if (teamByName) {
                        store.dispatch(selectTeam(teamByName.id));
                        store.dispatch(switchTeam(`/${teamByName.name}`));
                    }
                }
            }
            break;
        }
        default:
            break;
        }
    };

    const typeLabel = type.toLowerCase();
    const tooltipText = `Go to ${typeLabel}`;

    return (
        <WithTooltip
            title={tooltipText}
            forcedPlacement='top'
        >
            <button
                type='button'
                className='inline-entity-link'
                onClick={handleClick}
                aria-label={tooltipText}
                style={{cursor: 'pointer'}}
            >
                <LinkVariantIcon
                    size={14}
                />
                <span className='inline-entity-link__label'>
                    {typeLabel}
                </span>
            </button>
        </WithTooltip>
    );
}

