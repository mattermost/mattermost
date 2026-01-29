// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import {getCurrentTeam, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {switchTeam} from 'actions/team_actions';

import * as Menu from 'components/menu';
import TeamIcon from 'components/widgets/team_icon/team_icon';
import WithTooltip from 'components/with_tooltip';

import {imageURLForTeam} from 'utils/utils';

import TeamAvatar from './team_avatar';

import './team_section.scss';

/**
 * TeamSection displays the current team avatar at the top of the sidebar.
 * For multiple teams: shows a dropdown to switch between teams.
 * For single team: shows avatar with tooltip only.
 */
const TeamSection = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const currentTeam = useSelector(getCurrentTeam);
    const myTeams = useSelector(getMyTeams);

    const hasMultipleTeams = myTeams.length > 1;

    const handleSwitchTeam = useCallback((team: Team) => {
        // Build the team URL from the team name
        const teamUrl = `/${team.name}`;
        dispatch(switchTeam(teamUrl));
    }, [dispatch]);

    if (!currentTeam) {
        return null;
    }

    // Single team - show avatar with tooltip only
    if (!hasMultipleTeams) {
        return (
            <div className='TeamSection'>
                <WithTooltip
                    title={currentTeam.display_name}
                    isVertical={false}
                >
                    <div className='TeamSection__avatarWrapper'>
                        <TeamAvatar
                            team={currentTeam}
                            hasMultipleTeams={false}
                        />
                    </div>
                </WithTooltip>
            </div>
        );
    }

    // Multiple teams - show avatar with dropdown
    const tooltipText = formatMessage(
        {
            id: 'product_sidebar.teamSection.switchTeams',
            defaultMessage: '{teamName} - Click to switch teams',
        },
        {teamName: currentTeam.display_name},
    );

    return (
        <div className='TeamSection'>
            <Menu.Container
                menuButton={{
                    id: 'productSidebarTeamMenuButton',
                    class: 'TeamSection__menuButton',
                    children: (
                        <TeamAvatar
                            team={currentTeam}
                            hasMultipleTeams={true}
                        />
                    ),
                }}
                menuButtonTooltip={{
                    text: tooltipText,
                    isVertical: false,
                }}
                menu={{
                    id: 'productSidebarTeamMenu',
                    'aria-label': formatMessage({
                        id: 'product_sidebar.teamSection.menuAriaLabel',
                        defaultMessage: 'Team switcher',
                    }),
                    className: 'TeamSection__menu',
                }}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                {myTeams.map((team) => (
                    <TeamMenuItem
                        key={team.id}
                        team={team}
                        isCurrentTeam={team.id === currentTeam.id}
                        onSelect={handleSwitchTeam}
                    />
                ))}
            </Menu.Container>
        </div>
    );
};

interface TeamMenuItemProps {
    team: Team;
    isCurrentTeam: boolean;
    onSelect: (team: Team) => void;
}

const TeamMenuItem = ({team, isCurrentTeam, onSelect}: TeamMenuItemProps): JSX.Element => {
    const teamIconUrl = imageURLForTeam(team);

    const handleClick = useCallback(() => {
        if (!isCurrentTeam) {
            onSelect(team);
        }
    }, [team, isCurrentTeam, onSelect]);

    return (
        <Menu.Item
            onClick={handleClick}
            leadingElement={(
                <TeamIcon
                    url={teamIconUrl}
                    content={team.display_name}
                    size='xsm'
                />
            )}
            labels={<span>{team.display_name}</span>}
            trailingElements={
                isCurrentTeam ? (
                    <CheckIcon
                        size={16}
                        className='TeamSection__checkIcon'
                    />
                ) : undefined
            }
            aria-current={isCurrentTeam ? 'true' : undefined}
        />
    );
};

export default TeamSection;
