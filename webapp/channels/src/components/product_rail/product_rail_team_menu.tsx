// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckIcon, DockLeftIcon} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import {getTeamsUnreadStatuses} from 'mattermost-redux/selectors/entities/channels';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {switchTeam} from 'actions/team_actions';
import {setTeamSidebarHidden} from 'actions/views/product_rail';
import {getCurrentLocale} from 'selectors/i18n';

import * as Menu from 'components/menu';
import {getTeamSwitchURL} from 'components/team_sidebar/team_sidebar';

import {Preferences} from 'utils/constants';
import {isTeamScopedProduct, useCurrentProduct} from 'utils/products';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';
import {imageURLForTeam} from 'utils/utils';

import type {GlobalState} from 'types/store';

const messages = defineMessages({
    buttonLabel: {
        id: 'product_rail.teamMenu.buttonLabel',
        defaultMessage: 'Switch teams',
        description: 'Accessible name of the current team button at the top of the product navigation rail, shown while the team sidebar is hidden. It opens a menu of the user\'s teams.',
    },
    menuLabel: {
        id: 'product_rail.teamMenu.menuLabel',
        defaultMessage: 'Teams',
        description: 'Accessible name of the menu of the user\'s teams opened from the top of the product navigation rail.',
    },
    showTeamSidebar: {
        id: 'product_rail.teamMenu.showTeamSidebar',
        defaultMessage: 'Show team sidebar',
        description: 'Last item in the team menu at the top of the product navigation rail. It brings back the team sidebar the user hid.',
    },
});

// Stands in for the team sidebar at the top of the product rail while the user has hidden it:
// shows the current team, and opens a menu to switch teams or bring the team sidebar back.
export default function ProductRailTeamMenu() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const currentTeam = useSelector(getCurrentTeam);
    const myTeams = useSelector(getMyTeams);
    const locale = useSelector(getCurrentLocale);
    const teamsOrder = useSelector((state: GlobalState) => getPreference(state, Preferences.TEAMS_ORDER, '', ''));
    const [unreadTeamsSet, mentionsInTeamMap, teamHasUrgentMap] = useSelector(getTeamsUnreadStatuses);
    const currentProduct = useCurrentProduct();

    if (!currentTeam) {
        return null;
    }

    const teams = filterAndSortTeamsByDisplayName(myTeams, locale, teamsOrder);

    // Other teams' activity shows on the button, since their own icons are tucked away in the menu.
    const otherTeamsUnread = teams.some((team) => team.id !== currentTeam.id && unreadTeamsSet.has(team.id));

    // As in the team sidebar: team-scoped products and Channels carry the team in the URL, while
    // global products switch the team without navigating.
    const switchTo = (team: Team) => {
        const switchByTeam = currentProduct !== null && !isTeamScopedProduct(currentProduct);
        dispatch(switchTeam(getTeamSwitchURL(currentProduct, team.name), switchByTeam ? team : undefined));
    };

    return (
        <Menu.Container
            menuButton={{
                id: 'productRailTeamMenuButton',
                class: 'ProductRail__teamButton',
                'aria-label': formatMessage(messages.buttonLabel),
                children: (
                    <span className='ProductRail__teamStack'>
                        {/* Cards peeking out below the current team hint at the others in the menu. */}
                        {teams.length > 2 && <span className='ProductRail__teamStackCard ProductRail__teamStackCard--back'/>}
                        {teams.length > 1 && <span className='ProductRail__teamStackCard'/>}
                        <TeamAvatar
                            team={currentTeam}
                            size='lg'
                        />
                        {otherTeamsUnread && <span className='ProductRail__dot'/>}
                    </span>
                ),
            }}
            menuButtonTooltip={{
                text: currentTeam.display_name,
            }}
            menu={{
                id: 'productRailTeamMenu',
                width: '264px',
                'aria-label': formatMessage(messages.menuLabel),
            }}
            anchorOrigin={{vertical: 'top', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'left'}}
        >
            {teams.map((team) => {
                const mentions = mentionsInTeamMap.get(team.id) ?? 0;

                let trailingElement;
                if (team.id === currentTeam.id) {
                    trailingElement = (
                        <CheckIcon
                            size={18}
                            aria-hidden='true'
                        />
                    );
                } else if (mentions > 0) {
                    trailingElement = (
                        <span className={classNames('ProductRail__menuBadge', {'ProductRail__menuBadge--urgent': teamHasUrgentMap.get(team.id)})}>
                            {mentions > 99 ? '99+' : String(mentions)}
                        </span>
                    );
                } else if (unreadTeamsSet.has(team.id)) {
                    trailingElement = <span className='ProductRail__menuDot'/>;
                }

                return (
                    <Menu.Item
                        key={team.id}
                        id={`productRailTeamMenu-${team.name}`}
                        leadingElement={(
                            <TeamAvatar
                                team={team}
                                size='md'
                            />
                        )}
                        className='ProductRail__teamMenuItem'
                        labels={<span className='ProductRail__teamMenuLabel'>{team.display_name}</span>}
                        trailingElements={trailingElement}
                        onClick={() => switchTo(team)}
                    />
                );
            })}
            <Menu.Separator/>
            <Menu.Item
                id='productRailTeamMenu-showTeamSidebar'
                leadingElement={(
                    <DockLeftIcon
                        size={18}
                        aria-hidden='true'
                    />
                )}
                labels={<span>{formatMessage(messages.showTeamSidebar)}</span>}
                onClick={() => dispatch(setTeamSidebarHidden(false))}
            />
        </Menu.Container>
    );
}

// A team's image, or its initials, in a rounded square: 'lg' for the rail, 'md' for menu rows.
function TeamAvatar({team, size}: {team: Team; size: 'md' | 'lg'}) {
    const imageURL = imageURLForTeam(team);
    const className = classNames('ProductRail__teamAvatar', `ProductRail__teamAvatar--${size}`);

    if (imageURL) {
        return (
            <span
                className={className}
                style={{backgroundImage: `url('${imageURL}')`}}
                aria-hidden='true'
            />
        );
    }

    return (
        <span
            className={className}
            aria-hidden='true'
        >
            {team.display_name.replace(/\s/g, '').substring(0, 2)}
        </span>
    );
}
