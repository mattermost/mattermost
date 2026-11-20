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
    buttonLabelWithMentions: {
        id: 'product_rail.teamMenu.buttonLabelWithMentions',
        defaultMessage: 'Switch teams, {count, plural, one {# mention} other {# mentions}} in other teams',
        description: 'Accessible name of the current team button at the top of the product navigation rail when the user\'s other teams have mentions. {count} is their total, shown in a badge on the button.',
    },
    buttonLabelWithUnreads: {
        id: 'product_rail.teamMenu.buttonLabelWithUnreads',
        defaultMessage: 'Switch teams, unread messages in other teams',
        description: 'Accessible name of the current team button at the top of the product navigation rail when the user\'s other teams have unread messages but no mentions, shown as a dot on the button.',
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
// shows the current team, and opens a menu on hover (or click) to switch teams or bring the team
// sidebar back.
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

    // Other teams' activity shows on the button, since their own icons are tucked away in the menu:
    // their mentions as a count, or else a dot for unread messages.
    const otherTeams = teams.filter((team) => team.id !== currentTeam.id);
    const otherTeamsMentions = otherTeams.reduce((total, team) => total + (mentionsInTeamMap.get(team.id) ?? 0), 0);
    const otherTeamsUrgent = otherTeams.some((team) => teamHasUrgentMap.get(team.id));
    const otherTeamsUnread = otherTeams.some((team) => unreadTeamsSet.has(team.id));

    // The badge's count, or the dot, is read out with the button's name.
    let buttonLabel = formatMessage(messages.buttonLabel);
    if (otherTeamsMentions > 0) {
        buttonLabel = formatMessage(messages.buttonLabelWithMentions, {count: otherTeamsMentions});
    } else if (otherTeamsUnread) {
        buttonLabel = formatMessage(messages.buttonLabelWithUnreads);
    }

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
                'aria-label': buttonLabel,
                children: (
                    <span className='ProductRail__teamStack'>
                        {/* Cards peeking out below the current team hint at the others in the menu. */}
                        {teams.length > 2 && <span className='ProductRail__teamStackCard ProductRail__teamStackCard--back'/>}
                        {teams.length > 1 && <span className='ProductRail__teamStackCard'/>}
                        <TeamAvatar
                            team={currentTeam}
                            size='lg'
                        />
                        <TeamIndicator
                            className='ProductRail__badge'
                            dotClassName='ProductRail__dot'
                            mentions={otherTeamsMentions}
                            hasUrgent={otherTeamsUrgent}
                            unread={otherTeamsUnread}
                        />
                    </span>
                ),
            }}
            menu={{
                id: 'productRailTeamMenu',
                width: '264px',
                'aria-label': formatMessage(messages.menuLabel),

                // Hovering the team opens the teams, as the team sidebar would show them.
                openOnHover: true,
            }}
            anchorOrigin={{vertical: 'top', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'left'}}
        >
            {teams.map((team) => (
                <Menu.Item
                    key={team.id}
                    id={`productRailTeamMenu-${team.name}`}
                    leadingElement={(
                        <TeamAvatar
                            team={team}
                            size='md'
                        >
                            {team.id !== currentTeam.id && (
                                <TeamIndicator
                                    className='ProductRail__menuBadge'
                                    dotClassName='ProductRail__menuDot'
                                    mentions={mentionsInTeamMap.get(team.id) ?? 0}
                                    hasUrgent={teamHasUrgentMap.get(team.id) ?? false}
                                    unread={unreadTeamsSet.has(team.id)}
                                />
                            )}
                        </TeamAvatar>
                    )}
                    className='ProductRail__teamMenuItem'
                    labels={<span className='ProductRail__teamMenuLabel'>{team.display_name}</span>}
                    trailingElements={team.id === currentTeam.id ? (
                        <CheckIcon
                            size={18}
                            aria-hidden='true'
                        />
                    ) : undefined}
                    onClick={() => switchTo(team)}
                />
            ))}
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

const formatMentionCount = (mentions: number) => (mentions > 99 ? '99+' : String(mentions));

// A team's mention count as a badge, or else a dot for unread messages, on its avatar.
function TeamIndicator({className, dotClassName, mentions, hasUrgent, unread}: {className: string; dotClassName: string; mentions: number; hasUrgent: boolean; unread: boolean}) {
    if (mentions > 0) {
        return (
            <span className={classNames(className, {[`${className}--urgent`]: hasUrgent})}>
                {formatMentionCount(mentions)}
            </span>
        );
    }
    if (unread) {
        return <span className={dotClassName}/>;
    }
    return null;
}

// A team's image, or its initials, in a rounded square: 'lg' for the rail, 'md' for menu rows. Its
// children (an activity indicator) sit on its corner.
function TeamAvatar({team, size, children}: {team: Team; size: 'md' | 'lg'; children?: React.ReactNode}) {
    const imageURL = imageURLForTeam(team);
    const className = classNames('ProductRail__teamAvatar', `ProductRail__teamAvatar--${size}`);

    if (imageURL) {
        return (
            <span
                className={className}
                style={{backgroundImage: `url('${imageURL}')`}}
            >
                {children}
            </span>
        );
    }

    return (
        <span className={className}>
            <span aria-hidden='true'>{team.display_name.replace(/\s/g, '').substring(0, 2)}</span>
            {children}
        </span>
    );
}
