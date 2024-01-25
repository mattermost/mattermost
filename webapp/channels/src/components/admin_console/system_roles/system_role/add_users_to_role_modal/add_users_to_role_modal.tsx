// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import type {IntlShape} from 'react-intl';
import {injectIntl, FormattedMessage} from 'react-intl';

import type {Role} from '@mattermost/types/roles';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {filterProfiles} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {filterProfilesStartingWithTerm, profileListToMap, isGuest} from 'mattermost-redux/utils/user_utils';

import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';
import ProfilePicture from 'components/profile_picture';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {displayEntireNameForUser, localizeMessage} from 'utils/utils';

import {rolesStrings} from '../../strings';

const USERS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = 20;

type UserProfileValue = Value & UserProfile;

export type Props = {
    role: Role;
    users: UserProfile[];
    excludeUsers: { [userId: string]: UserProfile };
    includeUsers: { [userId: string]: UserProfile };
    intl: IntlShape;
    onAddCallback: (users: UserProfile[]) => void;
    onExited: () => void;

    actions: {
        getProfiles: (page: number, perPage?: number, options?: Record<string, any>) => Promise<ActionResult<UserProfile[]>>;
        searchProfiles: (term: string, options?: Record<string, any>) => Promise<ActionResult<UserProfile[]>>;
    };
}

type State = {
    searchResults: UserProfile[];
    values: UserProfileValue[];
    show: boolean;
    saving: boolean;
    addError: null;
    loading: boolean;
    term: string;
}

function searchUsersToAdd(users: Record<string, UserProfile>, term: string): Record<string, UserProfile> {
    const profilesList: UserProfile[] = Object.keys(users).map((key) => users[key]);
    const filteredProfilesList = filterProfilesStartingWithTerm(profilesList, term);
    return filterProfiles(profileListToMap(filteredProfilesList), {});
}

export class AddUsersToRoleModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            searchResults: [],
            values: [],
            show: true,
            saving: false,
            addError: null,
            loading: true,
            term: '',
        };
    }

    componentDidMount = async () => {
        await this.props.actions.getProfiles(0, USERS_PER_PAGE * 2);
        this.setUsersLoadingState(false);
    };

    setUsersLoadingState = (loading: boolean) => {
        this.setState({loading});
    };

    search = async (term: string) => {
        this.setUsersLoadingState(true);
        const searchResults: UserProfile[] = [];
        const search = term !== '';
        if (search) {
            const {data} = await this.props.actions.searchProfiles(term, {replace: true});
            data!.forEach((user) => {
                if (!user.is_bot) {
                    searchResults.push(user);
                }
            });
        } else {
            await this.props.actions.getProfiles(0, USERS_PER_PAGE * 2);
        }
        this.setState({loading: false, searchResults, term});
    };

    handleHide = () => {
        this.setState({show: false});
    };

    handleExit = () => {
        if (this.props.onExited) {
            this.props.onExited();
        }
    };

    renderOption = (option: UserProfileValue, isSelected: boolean, onAdd: (user: UserProfileValue) => void, onMouseMove: (user: UserProfileValue) => void) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        return (
            <div
                key={option.id}
                ref={isSelected ? 'selected' : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
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
                </div>
                <div className='more-modal__actions'>
                    <div className='more-modal__actions--round'>
                        <i
                            className='icon icon-plus'
                        />
                    </div>
                </div>
            </div>
        );
    };

    renderValue = (value: { data: UserProfileValue }): string => {
        return value.data?.username || '';
    };

    renderAriaLabel = (option: UserProfileValue): string => {
        return option?.username || '';
    };

    handleAdd = (value: UserProfileValue) => {
        const values: UserProfileValue[] = [...this.state.values];
        if (!values.includes(value)) {
            values.push(value);
        }
        this.setState({values});
    };

    handleDelete = (values: UserProfileValue[]) => {
        this.setState({values});
    };

    handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            const needMoreUsers = (this.props.users.length / USERS_PER_PAGE) <= page + 1;
            this.setUsersLoadingState(needMoreUsers);
            this.props.actions.getProfiles(page, USERS_PER_PAGE * 2).
                then(() => this.setUsersLoadingState(false));
        }
    };

    handleSubmit = () => {
        this.props.onAddCallback(this.state.values);
        this.handleHide();
    };

    render = (): JSX.Element => {
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

        const buttonSubmitText = localizeMessage('multiselect.add', 'Add');
        const buttonSubmitLoadingText = localizeMessage('multiselect.adding', 'Adding...');

        let addError = null;
        if (this.state.addError) {
            addError = (<div className='has-error col-sm-12'><label className='control-label font-weight--normal'>{this.state.addError}</label></div>);
        }

        let usersToDisplay: UserProfile[] = [];
        usersToDisplay = this.state.term ? this.state.searchResults : this.props.users;
        if (this.props.excludeUsers) {
            const hasUser = (user: UserProfile) => !this.props.excludeUsers[user.id];
            usersToDisplay = usersToDisplay.filter(hasUser);
        }

        if (this.props.includeUsers) {
            let {includeUsers} = this.props;
            if (this.state.term) {
                includeUsers = searchUsersToAdd(includeUsers, this.state.term);
            }
            usersToDisplay = [...usersToDisplay, ...Object.values(includeUsers)];
        }

        const options = usersToDisplay.map((user) => {
            return {label: user.username, value: user.id, ...user};
        });

        const name = rolesStrings[this.props.role.name] ? <FormattedMessage {...rolesStrings[this.props.role.name].name}/> : this.props.role.name;

        return (
            <Modal
                id='addUsersToRoleModal'
                dialogClassName={'a11y__modal more-modal more-direct-channels'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title componentClass='h1'>
                        <FormattedMessage
                            id='add_users_to_role.title'
                            defaultMessage='Add users to {roleName}'
                            values={{
                                roleName: (
                                    <strong>
                                        {name}
                                    </strong>
                                ),
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {addError}
                    <MultiSelect
                        key='addUsersToRoleKey'
                        options={options}
                        optionRenderer={this.renderOption}
                        intl={this.props.intl}
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
                        placeholderText={localizeMessage('multiselect.placeholder', 'Search and add members')}
                    />
                </Modal.Body>
            </Modal>
        );
    };
}

export default injectIntl(AddUsersToRoleModal);
