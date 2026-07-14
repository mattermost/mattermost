// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {DragDropContext, Droppable} from 'react-beautiful-dnd';
import type {DroppableProvided, DropResult} from 'react-beautiful-dnd';
import {injectIntl, FormattedMessage} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {Team} from '@mattermost/types/teams';

import Permissions from 'mattermost-redux/constants/permissions';

import Scrollbars from 'components/common/scrollbars';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import TeamButton from 'components/team_sidebar/components/team_button';

import WebSocketClient from 'client/web_websocket_client';
import Pluggable from 'plugins/pluggable';
import {Constants} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {getCurrentProduct, getTeamScopedProductURL, isTeamScopedProduct} from 'utils/products';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';
import * as Utils from 'utils/utils';

import type {ProductComponent} from 'types/store/plugins';

import type {PropsFromRedux} from './index';

// The URL to switch to for a team: a team-scoped product keeps you in the product on the new
// team; otherwise it's the team's channels.
export function getTeamSwitchURL(currentProduct: ProductComponent | null, teamName: string): string {
    if (currentProduct && isTeamScopedProduct(currentProduct)) {
        return getTeamScopedProductURL(currentProduct.baseURL, teamName);
    }
    return `/${teamName}`;
}

export interface Props extends PropsFromRedux, WrappedComponentProps {
    location: RouteComponentProps['location'];
}

type State = {
    showOrder: boolean;
    teamsOrder: Team[];
};

export class TeamSidebar extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            showOrder: false,
            teamsOrder: [],
        };
    }

    // Switch to `team`, respecting the current product. Team-scoped products and Channels carry the
    // team in the URL, so navigate there; global products (e.g. Boards) aren't URL-tied to a team,
    // so dispatch selectTeam without navigating. Used by both the click and keyboard switch paths.
    switchTeamTo = (team: Team) => {
        const currentProduct = getCurrentProduct(this.props.products, this.props.location.pathname);
        const switchByTeam = currentProduct !== null && !isTeamScopedProduct(currentProduct);
        this.props.actions.switchTeam(getTeamSwitchURL(currentProduct, team.name), switchByTeam ? team : undefined);
    };

    switchToPrevOrNextTeam = (e: KeyboardEvent, currentTeamId: string, teams: Team[]) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.UP) || Keyboard.isKeyPressed(e, Constants.KeyCodes.DOWN)) {
            e.preventDefault();
            const delta = Keyboard.isKeyPressed(e, Constants.KeyCodes.DOWN) ? 1 : -1;
            const pos = teams.findIndex((team: Team) => team.id === currentTeamId);
            const newPos = pos + delta;

            let team;
            if (newPos === -1) {
                team = teams[teams.length - 1];
            } else if (newPos === teams.length) {
                team = teams[0];
            } else {
                team = teams[newPos];
            }

            this.switchTeamTo(team);
            return true;
        }
        return false;
    };

    switchToTeamByNumber = (e: KeyboardEvent, currentTeamId: string, teams: Team[]) => {
        const digits = [
            Constants.KeyCodes.ONE,
            Constants.KeyCodes.TWO,
            Constants.KeyCodes.THREE,
            Constants.KeyCodes.FOUR,
            Constants.KeyCodes.FIVE,
            Constants.KeyCodes.SIX,
            Constants.KeyCodes.SEVEN,
            Constants.KeyCodes.EIGHT,
            Constants.KeyCodes.NINE,
            Constants.KeyCodes.ZERO,
        ];

        for (const idx in digits) {
            if (Keyboard.isKeyPressed(e, digits[idx]) && parseInt(idx, 10) < teams.length) {
                e.preventDefault();

                // prevents reloading the current team, while still capturing the keyboard shortcut
                if (teams[idx].id === currentTeamId) {
                    return false;
                }
                const team = teams[idx];
                this.switchTeamTo(team);
                return true;
            }
        }
        return false;
    };

    handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.altKey) {
            const {currentTeamId} = this.props;
            const teams = filterAndSortTeamsByDisplayName(this.props.myTeams, this.props.locale, this.props.userTeamsOrderPreference);

            if (this.switchToPrevOrNextTeam(e, currentTeamId, teams)) {
                return;
            }

            if (this.switchToTeamByNumber(e, currentTeamId, teams)) {
                return;
            }

            this.setState({showOrder: true});
        }
    };

    handleKeyUp = (e: KeyboardEvent) => {
        if (!((e.ctrlKey || e.metaKey) && e.altKey)) {
            this.setState({showOrder: false});
        }
    };

    componentDidUpdate(prevProps: Props) {
        // TODO: debounce
        if (prevProps.currentTeamId !== this.props.currentTeamId) {
            WebSocketClient.updateActiveTeam(this.props.currentTeamId);
        }
    }

    componentDidMount() {
        // for_directory: the "join another team" indicator is a discovery surface,
        // so policy-governed teams the user can't join are hidden here too — even
        // for admins, who are otherwise exempt on the System Console listing.
        this.props.actions.getTeams(0, 200, false, false, true);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }

    onDragEnd = (result: DropResult) => {
        const {
            updateTeamsOrderForUser,
        } = this.props.actions;

        if (!result.destination) {
            return;
        }

        const teams = filterAndSortTeamsByDisplayName(this.props.myTeams, this.props.locale, this.props.userTeamsOrderPreference);

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        // Positioning the dropped Team button
        const popElement = (list: Team[], idx: number) => {
            return [...list.slice(0, idx), ...list.slice(idx + 1, list.length)];
        };

        const pushElement = (list: Team[], idx: number, itemId: string): Team[] => {
            return [
                ...list.slice(0, idx),
                teams.find((team) => team.id === itemId)!,
                ...list.slice(idx, list.length),
            ];
        };

        const newTeamsOrder = pushElement(
            popElement(teams, sourceIndex),
            destinationIndex,
            result.draggableId,
        );
        updateTeamsOrderForUser(newTeamsOrder.map((o: Team) => o.id));
        this.setState({teamsOrder: newTeamsOrder});
    };

    render() {
        const {intl} = this.props;
        const root: Element | null = document.querySelector('#root');
        if (this.props.myTeams.length <= 1) {
            root!.classList.remove('multi-teams');
            return null;
        }
        root!.classList.add('multi-teams');

        const plugins = [];
        const sortedTeams = filterAndSortTeamsByDisplayName(this.props.myTeams, this.props.locale, this.props.userTeamsOrderPreference);

        const currentProduct = getCurrentProduct(this.props.products, this.props.location.pathname);
        if (currentProduct && !currentProduct.showTeamSidebar) {
            return null;
        }

        const teams = sortedTeams.map((team: Team, index: number) => {
            return (
                <TeamButton
                    key={'switch_team_' + team.name}
                    url={getTeamSwitchURL(currentProduct, team.name)}
                    tip={team.display_name}
                    active={team.id === this.props.currentTeamId}
                    displayName={team.display_name}
                    order={index + 1}
                    showOrder={this.state.showOrder}
                    unread={this.props.unreadTeamsSet.has(team.id)}
                    mentions={this.props.mentionsInTeamMap.has(team.id) ? this.props.mentionsInTeamMap.get(team.id) : 0}
                    hasUrgent={this.props.teamHasUrgentMap.has(team.id) ? this.props.teamHasUrgentMap.get(team.id) : false}
                    teamIconUrl={Utils.imageURLForTeam(team)}
                    switchTeam={() => this.switchTeamTo(team)}
                    isDraggable={true}
                    teamId={team.id}
                    teamIndex={index}
                    isInProduct={Boolean(currentProduct)}
                />
            );
        });

        const joinableTeams = [];

        const plusIcon = (
            <i
                className='icon icon-plus'
                role={'img'}
                aria-label={intl.formatMessage({id: 'sidebar.team_menu.button.plusIcon', defaultMessage: 'Plus Icon'})}
            />
        );

        if (this.props.moreTeamsToJoin && !this.props.experimentalPrimaryTeam) {
            joinableTeams.push(
                <TeamButton
                    btnClass='team-btn__add'
                    key='more_teams'
                    url='/select_team'
                    tip={
                        <FormattedMessage
                            id='team_sidebar.join'
                            defaultMessage='Other teams you can join'
                        />
                    }
                    content={plusIcon}
                    switchTeam={this.props.actions.switchTeam}
                    displayName={intl.formatMessage({
                        id: 'team_sidebar.join',
                        defaultMessage: 'Other teams you can join',
                    })}
                />,
            );
        } else {
            joinableTeams.push(
                <SystemPermissionGate
                    permissions={[Permissions.CREATE_TEAM]}
                    key='more_teams'
                >
                    <TeamButton
                        btnClass='team-btn__add'
                        url='/create_team'
                        tip={
                            <FormattedMessage
                                id='navbar_dropdown.create'
                                defaultMessage='Create a Team'
                            />
                        }
                        content={plusIcon}
                        switchTeam={this.props.actions.switchTeam}
                        displayName={intl.formatMessage({
                            id: 'navbar_dropdown.create',
                            defaultMessage: 'Create a Team',
                        })}
                    />
                </SystemPermissionGate>,
            );
        }

        // Disable team sidebar pluggables in products until proper support can be provided.
        const isNonChannelsProduct = !currentProduct;
        if (isNonChannelsProduct) {
            plugins.push(
                <div
                    key='team-sidebar-bottom-plugin'
                    className='team-sidebar-bottom-plugin is-empty'
                >
                    <Pluggable pluggableName='BottomTeamSidebar'/>
                </div>,
            );
        }

        return (
            <div
                className={classNames('team-sidebar', {'move--right': this.props.isOpen})}
                role='navigation'
                aria-labelledby='teamSidebarWrapper'
            >
                <Scrollbars>
                    <div
                        className='team-wrapper'
                        id='teamSidebarWrapper'
                    >
                        <DragDropContext
                            onDragEnd={this.onDragEnd}
                        >
                            <Droppable
                                droppableId='my_teams'
                                type='TEAM_BUTTON'
                            >
                                {(provided: DroppableProvided) => {
                                    return (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                        >
                                            {teams}
                                            {provided.placeholder}
                                        </div>
                                    );
                                }}
                            </Droppable>
                        </DragDropContext>
                        {joinableTeams}
                    </div>
                </Scrollbars>
                {plugins}
            </div>
        );
    }
}

export default injectIntl(TeamSidebar);
