// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {RefObject} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Group, GroupsWithCount, SyncablePatch, SyncableType} from '@mattermost/types/groups';

import Constants from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import MultiSelect, {Value} from 'components/multiselect/multiselect';
import groupsAvatar from 'images/groups-avatar.png';
import AddIcon from 'components/widgets/icons/fa_add_icon';
import Nbsp from 'components/html_entities/nbsp';

const GROUPS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = 10;

type GroupValue = Value & {member_count?: number};

type Props = {
    currentTeamName: string;
    currentTeamId: string;
    searchTerm: string;
    groups: Group[];

    // used in tandem with 'skipCommit' to allow using this component without performing actual linking
    excludeGroups?: Group[];
    includeGroups?: Group[];
    onExited: () => void;
    skipCommit?: boolean;
    onAddCallback?: (groupIDs: string[]) => void;
    actions: Actions;
}

export type Actions = {
    getGroupsNotAssociatedToTeam: (teamID: string, q?: string, page?: number, perPage?: number) => Promise<{ data: Group[] } | { error: Error }>;
    setModalSearchTerm: (term: string) => void;
    linkGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType, patch: SyncablePatch) => Promise<{ data?: boolean; error?: Error }>;
    getAllGroupsAssociatedToTeam: (teamID: string, filterAllowReference: boolean, includeMemberCount: boolean) => Promise<{ data: GroupsWithCount } | { error: Error }>;
};

type State = {
    values: GroupValue[];
    show: boolean;
    search: boolean;
    saving: boolean;
    addError: null | string;
    loadingGroups: boolean;
}

export default class AddGroupsToTeamModal extends React.PureComponent<Props, State> {
    private searchTimeoutId: number;
    private readonly selectedItemRef: RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            values: [],
            show: true,
            search: false,
            saving: false,
            addError: null,
            loadingGroups: true,
        };

        this.selectedItemRef = React.createRef();
    }

    public componentDidMount() {
        Promise.all([
            this.props.actions.getGroupsNotAssociatedToTeam(this.props.currentTeamId, '', 0, GROUPS_PER_PAGE + 1),
            this.props.actions.getAllGroupsAssociatedToTeam(this.props.currentTeamId, false, true),
        ]).then(() => {
            this.setGroupsLoadingState(false);
        });
    }

    public componentDidUpdate(prevProps: Props) {
        if (this.props.searchTerm !== prevProps.searchTerm) {
            clearTimeout(this.searchTimeoutId);

            const searchTerm = this.props.searchTerm;
            if (searchTerm === '') {
                return;
            }

            this.searchTimeoutId = window.setTimeout(
                async () => {
                    this.setGroupsLoadingState(true);
                    await this.props.actions.getGroupsNotAssociatedToTeam(this.props.currentTeamId, searchTerm);
                    this.setGroupsLoadingState(false);
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );
        }
    }

    // public for tests
    public handleHide = () => {
        this.props.actions.setModalSearchTerm('');
        this.setState({show: false});
    }

    // public for tests
    public handleExit = (): void => {
        this.props.onExited();
    }

    // public for tests
    public handleResponse = (err?: Error): void => {
        let addError = null;
        if (err && err.message) {
            addError = err.message;
        }

        this.setState({
            saving: false,
            addError,
        });
    }

    // public for tests
    public handleSubmit = async () => {
        const groupIDs = this.state.values.map((v) => v.id);
        if (groupIDs.length === 0) {
            return;
        }
        if (this.props.skipCommit) {
            if (this.props.onAddCallback) {
                this.props.onAddCallback(groupIDs);
            }
            this.handleHide();
            return;
        }

        this.setState({saving: true});

        await Promise.all(groupIDs.map(async (groupID) => {
            const {error} = await this.props.actions.linkGroupSyncable(groupID, this.props.currentTeamId, SyncableType.Team, {auto_add: true, scheme_admin: false});
            this.handleResponse(error);
            if (!error) {
                this.handleHide();
            }
        }));
    }

    // public for tests
    public addValue = (value: GroupValue): void => {
        const values = Object.assign<GroupValue[], GroupValue[]>([], this.state.values);
        const userIds = values.map((v) => v.id);
        if (value && value.id && userIds.indexOf(value.id) === -1) {
            values.push(value);
        }

        this.setState({values});
    }

    private setGroupsLoadingState = (loadingState: boolean) => {
        this.setState({
            loadingGroups: loadingState,
        });
    }

    // public for tests
    public handlePageChange = (page: number, prevPage: number): void => {
        if (page > prevPage) {
            this.setGroupsLoadingState(true);
            this.props.actions.getGroupsNotAssociatedToTeam(this.props.currentTeamId, this.props.searchTerm, page, GROUPS_PER_PAGE + 1).then(() => {
                this.setGroupsLoadingState(false);
            });
        }
    }

    // public for tests
    public handleDelete = (values: GroupValue[]): void => this.setState({values});

    // public for tests
    public search = (term: string): void => this.props.actions.setModalSearchTerm(term);

    // public for tests
    public renderOption = (option: GroupValue, isSelected: boolean, onAdd: (value: GroupValue) => void, onMouseMove: (value: GroupValue) => void): JSX.Element => {
        const rowSelected = isSelected ? 'more-modal__row--selected' : '';

        return (
            <div
                key={option.id}
                ref={isSelected ? this.selectedItemRef : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
                onMouseMove={() => onMouseMove(option)}
            >
                <img
                    className='more-modal__image'
                    src={groupsAvatar}
                    alt='group picture'
                    width='32'
                    height='32'
                />
                <div
                    className='more-modal__details'
                >
                    <div className='more-modal__name'>
                        {option.display_name}<Nbsp/>{'-'}<Nbsp/><span className='more-modal__name_sub'>
                            <FormattedMessage
                                id='numMembers'
                                defaultMessage='{num, number} {num, plural, one {member} other {members}}'
                                values={{
                                    num: option.member_count,
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <div className='more-modal__actions--round'>
                        <AddIcon/>
                    </div>
                </div>
            </div>
        );
    }

    // public for tests
    public renderValue = (props: { data: Value }): string | undefined => props.data.display_name;

    public render(): JSX.Element {
        const numRemainingText = (
            <div id='numGroupsRemaining'>
                <FormattedMessage
                    id='multiselect.numGroupsRemaining'
                    defaultMessage='Use ↑↓ to browse, ↵ to select. You can add {num, number} more {num, plural, one {group} other {groups}}. '
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
            addError = (
                <div className='has-error col-sm-12'>
                    <label className='control-label font-weight--normal'>
                        {this.state.addError}
                    </label>
                </div>
            );
        }

        let groupsToShow = this.props.groups;
        if (this.props.excludeGroups) {
            const hasGroup = (og: Group) => !this.props.excludeGroups?.find((g) => g.id === og.id);
            groupsToShow = groupsToShow.filter(hasGroup);
        }
        if (this.props.includeGroups) {
            const hasGroup = (og: Group) => this.props.includeGroups?.find((g) => g.id === og.id);
            groupsToShow = [...groupsToShow, ...this.props.includeGroups.filter(hasGroup)];
        }

        const groupsOptionsToShow = groupsToShow.map((group) => {
            return {...group, label: group.display_name, value: group.id};
        });

        return (
            <Modal
                id='addGroupsToTeamModal'
                dialogClassName={'a11y__modal more-modal more-direct-channels'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title componentClass='h1'>
                        <FormattedMessage
                            id='add_groups_to_team.title'
                            defaultMessage='Add New Groups to {teamName} Team'
                            values={{
                                teamName: (
                                    <strong>{this.props.currentTeamName}</strong>
                                ),
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {addError}
                    <MultiSelect
                        key='addGroupsToTeamKey'
                        options={groupsOptionsToShow}
                        optionRenderer={this.renderOption}
                        selectedItemRef={this.selectedItemRef}
                        values={this.state.values}
                        valueRenderer={this.renderValue}
                        perPage={GROUPS_PER_PAGE}
                        handlePageChange={this.handlePageChange}
                        handleInput={this.search}
                        handleDelete={this.handleDelete}
                        handleAdd={this.addValue}
                        handleSubmit={this.handleSubmit}
                        maxValues={MAX_SELECTABLE_VALUES}
                        numRemainingText={numRemainingText}
                        buttonSubmitText={buttonSubmitText}
                        buttonSubmitLoadingText={buttonSubmitLoadingText}
                        saving={this.state.saving}
                        loading={this.state.loadingGroups}
                        placeholderText={localizeMessage('multiselect.addGroupsPlaceholder', 'Search and add groups')}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}
