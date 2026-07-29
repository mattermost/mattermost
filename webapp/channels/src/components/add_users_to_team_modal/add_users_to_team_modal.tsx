// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import type {IntlShape} from 'react-intl';
import {injectIntl, FormattedMessage, defineMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';
import ProfilePicture from 'components/profile_picture';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {displayEntireNameForUser} from 'utils/utils';

import './add_users_to_team_modal.scss';

const USERS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = 20;

type UserProfileValue = Value & UserProfile;

type Props = {
    team: Team;
    users: UserProfile[];
    intl: IntlShape;
    filterExcludeGuests?: boolean;
    excludeUsers: {[userId: string]: UserProfile};
    includeUsers: {[userId: string]: UserProfile};
    onAddCallback: (users: UserProfile[]) => void;
    onExited?: () => void;

    actions: {
        getProfilesNotInTeam: (teamId: string, groupConstrained: boolean, page: number, perPage?: number, options?: Record<string, any>) => Promise<ActionResult<UserProfile[]>>;
        searchProfiles: (term: string, options?: Record<string, any>) => Promise<ActionResult<UserProfile[]>>;
    };
};

type State = {
    searchResults: UserProfile[];
    values: UserProfileValue[];
    show: boolean;
    search: boolean;
    saving: boolean;
    addError: null;
    loading: boolean;
    filterOptions: {[key: string]: any};

    // IDs of users who satisfy the team's membership policy. Only consulted on a
    // private governed team, where non-matching users cannot be added.
    abacMatchingIds: Set<string>;
};

const ABAC_MATCH_HARD_CAP = 1000;

export class AddUsersToTeamModal extends React.PureComponent<Props, State> {
    selectedItemRef: React.RefObject<HTMLDivElement>;

    public constructor(props: Props) {
        super(props);

        let filterOptions = {};
        if (props.filterExcludeGuests) {
            filterOptions = {role: 'system_user'};
        }

        this.state = {
            searchResults: [],
            values: [],
            show: true,
            search: false,
            saving: false,
            addError: null,
            loading: true,
            filterOptions,
            abacMatchingIds: new Set(),
        };

        this.selectedItemRef = React.createRef();
    }
    public componentDidMount = async () => {
        await this.props.actions.getProfilesNotInTeam(this.props.team.id, false, 0, USERS_PER_PAGE * 2);

        // On a private governed team, load the policy-matching set up front so
        // every row can be marked qualifying or not before the admin interacts.
        if (this.isStrictlyFilteredTeam()) {
            await this.loadAbacMatchingIds();
        }
        this.setUsersLoadingState(false);
    };

    // Public team (open invite) governance is advisory — adds are not blocked.
    // Everything else with a policy is strict. Mirrors the server privacy test,
    // which keys on allow_open_invite alone (master's open-directory model).
    private isStrictlyFilteredTeam = (): boolean => {
        const team = this.props.team;
        if (!team.policy_enforced) {
            return false;
        }
        return !team.allow_open_invite;
    };

    private loadAbacMatchingIds = async () => {
        const teamId = this.props.team.id;
        const ids = new Set<string>();
        let cursorId = '';
        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                // eslint-disable-next-line no-await-in-loop
                const profiles = await Client4.getProfilesMatchingTeamPolicy(teamId, USERS_PER_PAGE, cursorId);
                if (!profiles || profiles.length === 0) {
                    break;
                }
                for (const profile of profiles) {
                    ids.add(profile.id);
                }
                if (profiles.length < USERS_PER_PAGE || ids.size >= ABAC_MATCH_HARD_CAP) {
                    break;
                }
                cursorId = profiles[profiles.length - 1].id;
            }
        } catch {
            // Leave the set empty; every candidate then reads as non-qualifying
            // and is blocked, which is the safe direction for a strict team.
        }
        this.setState({abacMatchingIds: ids});
    };

    private setUsersLoadingState = (loading: boolean) => {
        this.setState({loading});
    };

    public search = async (term: string) => {
        this.setUsersLoadingState(true);
        let searchResults: UserProfile[] = [];
        const search = term !== '';
        if (search) {
            const {data} = await this.props.actions.searchProfiles(term, {not_in_team_id: this.props.team.id, replace: true, ...this.state.filterOptions});
            searchResults = data!;
        } else {
            await this.props.actions.getProfilesNotInTeam(this.props.team.id, false, 0, USERS_PER_PAGE * 2);
        }
        this.setState({loading: false, searchResults, search});
    };

    public handleHide = () => {
        this.setState({show: false});
    };

    private handleExit = () => {
        if (this.props.onExited) {
            this.props.onExited();
        }
    };

    private renderOption = (option: UserProfileValue, isSelected: boolean, onAdd: (user: UserProfileValue) => void, onMouseMove: (user: UserProfileValue) => void) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        // Strict team: a candidate who doesn't satisfy the policy cannot be
        // added. The row stays visible with a textual reason (not colour alone)
        // and its add affordance is inert.
        const blocked = this.isStrictlyFilteredTeam() && !this.state.abacMatchingIds.has(option.id);

        return (
            <div
                key={option.id}
                ref={isSelected ? this.selectedItemRef : option.id}
                className={'more-modal__row ' + (blocked ? 'more-modal__row--disabled' : 'clickable ') + rowSelected}
                aria-disabled={blocked}
                onClick={blocked ? undefined : () => onAdd(option)}
                onMouseMove={() => onMouseMove(option)}
            >
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(option.id, option.last_picture_update)}
                    size='md'
                />
                <div className='more-modal__details'>
                    <div className='more-modal__name'>
                        {displayEntireNameForUser(option)}
                        {option.is_bot && <BotTag/>}
                        {isGuest(option.roles) && <GuestTag className='popoverlist'/>}
                    </div>
                    {blocked && (
                        <div
                            className='more-modal__error'
                            aria-live='polite'
                        >
                            <FormattedMessage
                                id='add_users_to_team.policy_denied'
                                defaultMessage='Does not meet membership requirements'
                            />
                        </div>
                    )}
                </div>
                {!blocked && (
                    <div className='more-modal__actions'>
                        <button
                            className='more-modal__actions--round'
                            aria-label='Add users to team'
                        >
                            <i
                                className='icon icon-plus'
                            />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    private renderValue = (value: {data: UserProfileValue}): string => {
        return value.data?.username || '';
    };

    private renderAriaLabel = (option: UserProfileValue): string => {
        return option?.username || '';
    };

    private handleAdd = (value: UserProfileValue) => {
        // Guard the keyboard-selection path too: a non-qualifying candidate on a
        // strict team must never enter the selection, even via Enter.
        if (this.isStrictlyFilteredTeam() && !this.state.abacMatchingIds.has(value.id)) {
            return;
        }
        const values: UserProfileValue[] = [...this.state.values];
        if (!values.includes(value)) {
            values.push(value);
        }
        this.setState({values});
    };

    private handleDelete = (values: UserProfileValue[]) => {
        this.setState({values});
    };

    private handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            const needMoreUsers = (this.props.users.length / USERS_PER_PAGE) <= page + 1;
            this.setUsersLoadingState(needMoreUsers);
            this.props.actions.getProfilesNotInTeam(this.props.team.id, false, page, USERS_PER_PAGE * 2).
                then(() => this.setUsersLoadingState(false));
        }
    };

    private handleSubmit = () => {
        this.props.onAddCallback(this.state.values);
        this.handleHide();
    };

    public render = (): JSX.Element => {
        const numRemainingText = (
            <div id='numPeopleRemaining'>
                <FormattedMessage
                    id='multiselect.numPeopleRemaining'
                    defaultMessage='Use ↑↓ to browse, ↵ to select. You can add {num, number} more {num, plural, one {person} other {people}}. '
                    values={{
                        num: MAX_SELECTABLE_VALUES - this.state.values.length,
                    }}
                />
            </div>
        );

        const buttonSubmitText = defineMessage({id: 'multiselect.add', defaultMessage: 'Add'});
        const buttonSubmitLoadingText = defineMessage({id: 'multiselect.adding', defaultMessage: 'Adding...'});

        let addError = null;
        if (this.state.addError) {
            addError = (<div className='has-error col-sm-12'><label className='control-label font-weight--normal'>{this.state.addError}</label></div>);
        }

        let usersToDisplay: UserProfile[] = [];
        usersToDisplay = this.state.search ? this.state.searchResults : this.props.users;
        if (this.props.excludeUsers) {
            const hasUser = (user: UserProfile) => !this.props.excludeUsers[user.id];
            usersToDisplay = usersToDisplay.filter(hasUser);
        }
        if (this.props.includeUsers) {
            const includeUsers = Object.values(this.props.includeUsers);
            usersToDisplay = [...usersToDisplay, ...includeUsers];
        }

        const options = usersToDisplay.map((user) => {
            return {label: user.username, value: user.id, ...user};
        });

        return (
            <Modal
                id='addUsersToTeamModal'
                dialogClassName={'a11y__modal more-modal more-direct-channels'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title componentClass='h1'>
                        <FormattedMessage
                            id='add_users_to_team.title'
                            defaultMessage='Add New Members to {teamName} Team'
                            values={{
                                teamName: (
                                    <strong>{this.props.team.name}</strong>
                                ),
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {addError}
                    <MultiSelect
                        key='addUsersToTeamKey'
                        options={options}
                        optionRenderer={this.renderOption}
                        intl={this.props.intl}
                        selectedItemRef={this.selectedItemRef}
                        ariaLabelRenderer={this.renderAriaLabel}
                        values={this.state.values}
                        valueRenderer={this.renderValue}
                        perPage={USERS_PER_PAGE}
                        handlePageChange={this.handlePageChange}
                        handleInput={this.search}
                        handleDelete={this.handleDelete}
                        handleAdd={this.handleAdd}
                        handleSubmit={this.handleSubmit}
                        maxValues={MAX_SELECTABLE_VALUES}
                        numRemainingText={numRemainingText}
                        buttonSubmitText={buttonSubmitText}
                        buttonSubmitLoadingText={buttonSubmitLoadingText}
                        saving={this.state.saving}
                        loading={this.state.loading}
                        placeholderText={defineMessage({id: 'multiselect.placeholder', defaultMessage: 'Search for people'})}
                    />
                </Modal.Body>
            </Modal>
        );
    };
}

export default injectIntl(AddUsersToTeamModal);
