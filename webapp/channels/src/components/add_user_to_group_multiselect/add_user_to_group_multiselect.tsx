// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {RelationOneToOne} from '@mattermost/types/utilities';
import React from 'react';

import {ActionResult} from 'mattermost-redux/types/actions';
import {filterProfilesStartingWithTerm} from 'mattermost-redux/utils/user_utils';

import MultiSelect, {Value} from 'components/multiselect/multiselect';

import Constants from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import MultiSelectOption from './multiselect_option/multiselect_option';

const USERS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = 256;

type UserProfileValue = Value & UserProfile;

export type Props = {
    multilSelectKey: string;
    userStatuses: RelationOneToOne<UserProfile, string>;
    focusOnLoad?: boolean;

    // Used if we are adding new members to an existing group
    groupId?: string;

    // onSubmitCallback takes an array of UserProfiles and should set usersToAdd in state of parent component
    onSubmitCallback: (userProfiles?: UserProfile[]) => Promise<void>;
    addUserCallback?: (userProfiles: UserProfile[]) => void;
    deleteUserCallback?: (userProfiles: UserProfile[]) => void;

    // These are the optinoal search parameters
    searchOptions?: any;

    // Dictionaries of userid mapped users to exclude or include from this list
    excludeUsers?: Record<string, UserProfileValue>;
    includeUsers?: Record<string, UserProfileValue>;

    profiles: UserProfileValue[];

    savingEnabled: boolean;
    saving: boolean;
    buttonSubmitText?: string;
    buttonSubmitLoadingText?: string;
    backButtonClick?: () => void;
    backButtonClass?: string;
    backButtonText?: string;

    actions: {
        getProfiles: (page?: number, perPage?: number) => Promise<ActionResult>;
        getProfilesNotInGroup: (groupId: string, page?: number, perPage?: number) => Promise<ActionResult>;
        loadStatusesForProfilesList: (users: UserProfile[]) => void;
        searchProfiles: (term: string, options: any) => Promise<ActionResult>;
    };
}

type State = {
    values: UserProfileValue[];
    term: string;
    loadingUsers: boolean;
}

export default class AddUserToGroupMultiSelect extends React.PureComponent<Props, State> {
    private searchTimeoutId = 0;
    selectedItemRef;

    public static defaultProps = {
        includeUsers: {},
        excludeUsers: {},
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            values: [],
            term: '',
            loadingUsers: true,
        } as State;

        this.selectedItemRef = React.createRef<HTMLDivElement>();
    }

    private addValue = (value: UserProfileValue): void => {
        const values: UserProfileValue[] = Object.assign([], this.state.values);
        if (values.indexOf(value) === -1) {
            values.push(value);
        }

        if (this.props.addUserCallback) {
            this.props.addUserCallback(values);
        }

        this.setState({values});
    };

    public componentDidMount(): void {
        if (this.props.groupId) {
            this.props.actions.getProfilesNotInGroup(this.props.groupId).then(() => {
                this.setUsersLoadingState(false);
            });
        } else {
            this.props.actions.getProfiles().then(() => {
                this.setUsersLoadingState(false);
            });
        }

        this.props.actions.loadStatusesForProfilesList(this.props.profiles);
    }

    private handleDelete = (values: UserProfileValue[]): void => {
        if (this.props.deleteUserCallback) {
            this.props.deleteUserCallback(values);
        }

        this.setState({values});
    };

    private setUsersLoadingState = (loadingState: boolean): void => {
        this.setState({
            loadingUsers: loadingState,
        });
    };

    private handlePageChange = (page: number, prevPage: number): void => {
        if (page > prevPage) {
            this.setUsersLoadingState(true);
            if (this.props.groupId) {
                this.props.actions.getProfilesNotInGroup(this.props.groupId, page + 1, USERS_PER_PAGE).then(() => {
                    this.setUsersLoadingState(false);
                });
            } else {
                this.props.actions.getProfiles(page + 1, USERS_PER_PAGE).then(() => {
                    this.setUsersLoadingState(false);
                });
            }
        }
    };

    public handleSubmit = (): void => {
        const userIds = this.state.values.map((v) => v.id);
        if (userIds.length === 0) {
            return;
        }
        this.props.onSubmitCallback(this.state.values);
    };

    public search = (searchTerm: string): void => {
        const term = searchTerm.trim();
        clearTimeout(this.searchTimeoutId);
        this.setState({
            term,
        });

        if (term) {
            this.setUsersLoadingState(true);
            this.searchTimeoutId = window.setTimeout(
                async () => {
                    await this.props.actions.searchProfiles(term, this.props.searchOptions);
                    this.setUsersLoadingState(false);
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );
        }
    };

    private renderAriaLabel = (option: UserProfileValue): string => {
        if (!option) {
            return '';
        }
        return option.username;
    };

    renderOption = (option: UserProfileValue, isSelected: boolean, onAdd: (user: UserProfileValue) => void, onMouseMove: (user: UserProfileValue) => void) => {
        return (
            <MultiSelectOption
                option={option}
                onAdd={onAdd}
                isSelected={isSelected}
                onMouseMove={onMouseMove}
                userStatuses={this.props.userStatuses}
                ref={isSelected ? this.selectedItemRef : undefined}
                key={option.id}
            />
        );
    };

    public render = (): JSX.Element => {
        const buttonSubmitText = this.props.buttonSubmitText || localizeMessage('multiselect.createGroup', 'Create Group');
        const buttonSubmitLoadingText = this.props.buttonSubmitLoadingText || localizeMessage('multiselect.creating', 'Creating...');

        let users = filterProfilesStartingWithTerm(this.props.profiles, this.state.term).filter((user) => {
            return user.delete_at === 0 &&
                (this.props.excludeUsers !== undefined && !this.props.excludeUsers[user.id]);
        }).map((user) => user as UserProfileValue);

        if (this.props.includeUsers) {
            const includeUsers = Object.values(this.props.includeUsers);
            users = [...users, ...includeUsers];
        }

        let maxValues;
        let numRemainingText = null;

        if (this.state.values.length >= MAX_SELECTABLE_VALUES) {
            maxValues = MAX_SELECTABLE_VALUES;
            numRemainingText = localizeMessage('multiselect.maxGroupMembers', 'No more than 256 members can be added to a group at once.');
        }

        return (
            <MultiSelect
                key={this.props.multilSelectKey}
                options={users}
                optionRenderer={this.renderOption}
                selectedItemRef={this.selectedItemRef}
                values={this.state.values}
                ariaLabelRenderer={this.renderAriaLabel}
                saveButtonPosition={'bottom'}
                perPage={USERS_PER_PAGE}
                handlePageChange={this.handlePageChange}
                handleInput={this.search}
                handleDelete={this.handleDelete}
                handleAdd={this.addValue}
                handleSubmit={this.handleSubmit}
                buttonSubmitText={buttonSubmitText}
                buttonSubmitLoadingText={buttonSubmitLoadingText}
                saving={this.props.saving}
                loading={this.state.loadingUsers}
                placeholderText={localizeMessage('multiselect.placeholder', 'Search for people')}
                valueWithImage={true}
                focusOnLoad={this.props.focusOnLoad}
                savingEnabled={this.props.savingEnabled}
                backButtonClick={this.props.backButtonClick}
                backButtonClass={this.props.backButtonClass}
                backButtonText={this.props.backButtonText}
                maxValues={maxValues}
                numRemainingText={numRemainingText}
            />
        );
    };
}
