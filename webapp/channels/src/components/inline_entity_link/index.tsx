// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent} from 'react';

import {LinkVariantIcon} from '@mattermost/compass-icons/components';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {loadIfNecessaryAndSwitchToChannelById} from 'actions/views/channel';
import store from 'stores/redux_store';

import {focusPost} from 'components/permalink_view/actions';
import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';

type Props = {
    type: string;
    value: string;
    onClick?: (type: string, value: string) => void;
};

export default function InlineEntityLink({type, value, onClick}: Props) {
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
        case Constants.InlineEntityTypes.CHANNEL:
            store.dispatch(loadIfNecessaryAndSwitchToChannelById(value));
            break;
        case Constants.InlineEntityTypes.TEAM: {
            const team = getTeam(state, value);
            if (team) {
                store.dispatch(selectTeam(value));
                getHistory().push(`/${team.name}`);
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

