// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy, memo, useEffect, useRef, useState} from 'react';
import {Route, Switch, useHistory, useParams} from 'react-router-dom';
import iNoBounce from 'inobounce';

import {ActionResult} from 'mattermost-redux/types/actions';

import {reconnect} from 'actions/websocket_actions.jsx';

import Constants from 'utils/constants';
import {cmdOrCtrlPressed, isKeyPressed} from 'utils/keyboard';
import {isIosSafari} from 'utils/user_agent';

import {makeAsyncComponent} from 'components/async_load';
import ChannelController from 'components/channel_layout/channel_controller';
import useTelemetryIdentitySync from 'components/common/hooks/useTelemetryIdentifySync';

import LocalStorageStore from 'stores/local_storage_store';

import {ServerError} from '@mattermost/types/errors';
import {Team} from '@mattermost/types/teams';

import type {OwnProps, PropsFromRedux} from './index';

const BackstageController = makeAsyncComponent('BackstageController', lazy(() => import('components/backstage')));
const Pluggable = makeAsyncComponent('Pluggable', lazy(() => import('plugins/pluggable')));

const WAKEUP_CHECK_INTERVAL = 30000; // 30 seconds
const WAKEUP_THRESHOLD = 60000; // 60 seconds
const UNREAD_CHECK_TIME_MILLISECONDS = 120 * 1000;

declare global {
    interface Window {
        isActive: boolean;
    }
}

type Props = PropsFromRedux & OwnProps;

function TeamController(props: Props) {
    const history = useHistory();
    const {team: teamNameParam} = useParams<Props['match']['params']>();

    const [initialChannelsLoaded, setInitialChannelsLoaded] = useState(false);

    const [team, setTeam] = useState<Team | null>(getTeamFromTeamList(props.teamsList, teamNameParam));

    const blurTime = useRef(Date.now());
    const lastTime = useRef(Date.now());

    useTelemetryIdentitySync();

    useEffect(() => {
        async function fetchInitialChannels() {
            if (props.graphQLEnabled) {
                await props.fetchChannelsAndMembers();
            } else {
                await props.fetchAllMyTeamsChannelsAndChannelMembersREST();
            }

            setInitialChannelsLoaded(true);
        }

        fetchInitialChannels();
    }, [props.graphQLEnabled]);

    useEffect(() => {
        const wakeUpIntervalId = setInterval(() => {
            const currentTime = Date.now();
            if ((currentTime - lastTime.current) > WAKEUP_THRESHOLD) {
                console.log('computer woke up - reconnecting'); //eslint-disable-line no-console
                reconnect();
            }
            lastTime.current = currentTime;
        }, WAKEUP_CHECK_INTERVAL);

        return () => {
            clearInterval(wakeUpIntervalId);
        };
    }, []);

    // Effect runs on mount, add event listeners on windows object
    useEffect(() => {
        function handleFocus() {
            if (props.selectedThreadId) {
                window.isActive = true;
            }
            if (props.currentChannelId) {
                window.isActive = true;
                props.markChannelAsReadOnFocus(props.currentChannelId);
            }

            // Temporary flag to disable refetching of channel members on browser focus
            if (!props.disableRefetchingOnBrowserFocus) {
                const currentTime = Date.now();
                if ((currentTime - blurTime.current) > UNREAD_CHECK_TIME_MILLISECONDS && props.currentTeamId) {
                    if (props.graphQLEnabled) {
                        props.fetchChannelsAndMembers(props.currentTeamId);
                    } else {
                        props.fetchMyChannelsAndMembersREST(props.currentTeamId);
                    }
                }
            }
        }

        function handleBlur() {
            window.isActive = false;
            blurTime.current = Date.now();

            if (props.currentUser) {
                props.viewChannel('');
            }
        }

        function handleKeydown(event: KeyboardEvent) {
            if (event.shiftKey && cmdOrCtrlPressed(event) && isKeyPressed(event, Constants.KeyCodes.L)) {
                const replyTextbox = document.querySelector<HTMLElement>('#sidebar-right.is-open.expanded #reply_textbox');
                if (replyTextbox) {
                    replyTextbox.focus();
                } else {
                    const postTextbox = document.getElementById('post_textbox');
                    if (postTextbox) {
                        postTextbox.focus();
                    }
                }
            }
        }

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('keydown', handleKeydown);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('keydown', handleKeydown);
        };
    }, [props.selectedThreadId, props.graphQLEnabled, props.currentChannelId, props.currentTeamId, props.currentUser.id]);

    // Effect runs on mount, adds active state to window
    useEffect(() => {
        const browserIsIosSafari = isIosSafari();
        if (browserIsIosSafari) {
            // Use iNoBounce to prevent scrolling past the boundaries of the page
            iNoBounce.enable();
        }

        // Set up tracking for whether the window is active
        window.isActive = true;

        LocalStorageStore.setTeamIdJoinedOnLoad(null);

        return () => {
            window.isActive = false;

            if (browserIsIosSafari) {
                iNoBounce.disable();
            }
        };
    }, []);

    async function initTeamOrRedirect(team: Team) {
        try {
            await props.initializeTeam(team);
            setTeam(team);
        } catch (error) {
            history.push('/error?type=team_not_found');
        }
    }

    async function joinTeamOrRedirect(teamNameParam: string, joinedOnFirstLoad: boolean) {
        setTeam(null);

        try {
            const {data: joinedTeam} = await props.joinTeam(teamNameParam, joinedOnFirstLoad) as ActionResult<Team, ServerError>; // Fix in MM-46907;
            if (joinedTeam) {
                setTeam(joinedTeam);
            } else {
                throw new Error('Unable to join team');
            }
        } catch (error) {
            history.push('/error?type=team_not_found');
        }
    }

    const teamsListDependency = props.teamsList.map((team) => team.id).sort().join('+');

    // Effect to run when url for team or teamsList changes
    useEffect(() => {
        if (teamNameParam) {
            // skip reserved team names
            if (Constants.RESERVED_TEAM_NAMES.includes(teamNameParam)) {
                return;
            }

            const teamFromTeamNameParam = getTeamFromTeamList(props.teamsList, teamNameParam);
            if (teamFromTeamNameParam) {
                // If the team is already in the teams list, initialize it when we switch teams
                initTeamOrRedirect(teamFromTeamNameParam);
            } else if (team && team.name !== teamNameParam) {
                // When we are already in a team and the new team is not in the teams list, attempt to join it
                joinTeamOrRedirect(teamNameParam, false);
            } else if (!team) {
                // When we are not in a team and the new team is not in the teams list, attempt to join it
                joinTeamOrRedirect(teamNameParam, true);
            }
        }
    }, [teamNameParam, teamsListDependency]);

    if (props.mfaRequired) {
        history.push('/mfa/setup');
        return null;
    }

    if (team === null) {
        return null;
    }

    return (
        <Switch>
            <Route
                path={'/:team/integrations'}
                component={BackstageController}
            />
            <Route
                path={'/:team/emoji'}
                component={BackstageController}
            />
            {props.plugins?.map((plugin) => (
                <Route
                    key={plugin.id}
                    path={'/:team/' + (plugin as any).route}
                    render={() => (
                        <Pluggable
                            pluggableName={'NeedsTeamComponent'}
                            pluggableId={plugin.id}
                            css={{gridArea: 'center'}}
                        />
                    )}
                />
            ))}
            <ChannelController shouldRenderCenterChannel={initialChannelsLoaded}/>
        </Switch>
    );
}

function getTeamFromTeamList(teamsList: Props['teamsList'], teamName?: string) {
    if (!teamName) {
        return null;
    }

    const team = teamsList.find((teamInList) => teamInList.name === teamName) ?? null;
    if (!team) {
        return null;
    }

    return team;
}

export default memo(TeamController);
