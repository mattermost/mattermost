// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getFavoritedTeamIds, getUnreadDmChannelsWithUsers} from 'selectors/views/guilded_layout';

import './expanded_overlay.scss';

interface Props {
    onClose: () => void;
}

function getTeamInitials(displayName: string): string {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function getUserDisplayName(user: {username: string; first_name?: string; last_name?: string}): string {
    if (user.first_name || user.last_name) {
        return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.username;
}

export default function ExpandedOverlay({onClose}: Props) {
    const allTeams = useSelector(getMyTeams);
    const favoritedTeamIds = useSelector(getFavoritedTeamIds);
    const currentTeamId = useSelector(getCurrentTeamId);
    const unreadDms = useSelector(getUnreadDmChannelsWithUsers);

    // Sort teams: favorites first, then alphabetically
    const sortedTeams = [...allTeams].sort((a, b) => {
        const aFav = favoritedTeamIds.includes(a.id);
        const bFav = favoritedTeamIds.includes(b.id);
        if (aFav && !bFav) {
            return -1;
        }
        if (!aFav && bFav) {
            return 1;
        }
        return a.display_name.localeCompare(b.display_name);
    });

    return (
        <div className='expanded-overlay'>
            <div className='expanded-overlay__header'>
                <span className='expanded-overlay__title'>Teams & DMs</span>
                <button
                    className='expanded-overlay__close'
                    onClick={onClose}
                    aria-label='Close'
                >
                    <i className='icon icon-close' />
                </button>
            </div>

            <div className='expanded-overlay__section'>
                <h3 className='expanded-overlay__section-title'>Teams</h3>
                <div className='expanded-overlay__teams'>
                    {sortedTeams.map((team) => (
                        <div
                            key={team.id}
                            className={classNames('expanded-overlay__team', {
                                'expanded-overlay__team--active': team.id === currentTeamId,
                            })}
                        >
                            <div className='expanded-overlay__team-icon'>
                                {team.last_team_icon_update ? (
                                    <img
                                        src={`/api/v4/teams/${team.id}/image?_=${team.last_team_icon_update}`}
                                        alt={team.display_name}
                                    />
                                ) : (
                                    <span>{getTeamInitials(team.display_name)}</span>
                                )}
                            </div>
                            <span className='expanded-overlay__team-name'>{team.display_name}</span>
                            {favoritedTeamIds.includes(team.id) && (
                                <i className='icon icon-star expanded-overlay__favorite-indicator' />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {unreadDms.length > 0 && (
                <div className='expanded-overlay__section'>
                    <h3 className='expanded-overlay__section-title'>Direct Messages</h3>
                    <div className='expanded-overlay__dms'>
                        {unreadDms.map((dm) => (
                            <div
                                key={dm.channel.id}
                                className='expanded-overlay__dm'
                            >
                                <div className='expanded-overlay__dm-avatar'>
                                    <img
                                        src={Client4.getProfilePictureUrl(dm.user.id, dm.user.last_picture_update)}
                                        alt={dm.user.username}
                                    />
                                    <span
                                        className={classNames('expanded-overlay__dm-status', {
                                            'expanded-overlay__dm-status--online': dm.status === 'online',
                                            'expanded-overlay__dm-status--away': dm.status === 'away',
                                            'expanded-overlay__dm-status--dnd': dm.status === 'dnd',
                                        })}
                                    />
                                </div>
                                <span className='expanded-overlay__dm-name'>
                                    {getUserDisplayName(dm.user)}
                                </span>
                                <span className='expanded-overlay__badge'>
                                    {dm.unreadCount}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
