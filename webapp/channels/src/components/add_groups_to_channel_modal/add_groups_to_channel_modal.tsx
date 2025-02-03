// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import type {IntlShape} from 'react-intl';
import {injectIntl, FormattedMessage, defineMessage} from 'react-intl';

import type {ServerError} from '@mattermost/types/errors';
import type {Group, SyncablePatch} from '@mattermost/types/groups';
import {SyncableType} from '@mattermost/types/groups';

import type {ActionResult} from 'mattermost-redux/types/actions';

import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';

import groupsAvatar from 'images/groups-avatar.png';
import Constants from 'utils/constants';

const GROUPS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = 10;

type GroupValue = (Group & Value);

export type Props = {
    currentChannelName: string;
    currentChannelId: string;
    intl: IntlShape;
    teamID: string;
    searchTerm: string;
    groups: Group[];
    excludeGroups?: Group[];
    includeGroups?: Group[];
    onExited: () => void;
    skipCommit?: boolean;
    onAddCallback?: (groupIDs: string[]) => void;

    actions: {
        getGroupsNotAssociatedToChannel: (channelID: string, q?: string, page?: number, perPage?: number, filterParentTeamPermitted?: boolean) => Promise<ActionResult>;
        setModalSearchTerm: (term: string) => void;
        linkGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType, patch: Partial<SyncablePatch>) => Promise<ActionResult>;
        getAllGroupsAssociatedToChannel: (channelID: string, filterAllowReference: boolean, includeMemberCount: boolean) => Promise<ActionResult>;
        getTeam: (teamId: string) => Promise<ActionResult>;
        getAllGroupsAssociatedToTeam: (teamID: string, filterAllowReference: boolean, includeMemberCount: boolean) => Promise<ActionResult>;
    };
}

type State = {
    values: GroupValue[];
    show: boolean;
    search: boolean;
    saving: boolean;
    addError: string | null;
    loadingGroups: boolean;
}

export class AddGroupsToChannelModal extends React.PureComponent<Props, State> {
    private searchTimeoutId: number;
    private selectedItemRef: React.RefObject<HTMLDivElement>;

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

    componentDidMount() {
        Promise.all([
            this.props.actions.getTeam(this.props.teamID),
            this.props.actions.getAllGroupsAssociatedToTeam(this.props.teamID, false, true),
            this.props.actions.getGroupsNotAssociatedToChannel(this.props.currentChannelId, '', 0, GROUPS_PER_PAGE + 1, true),
            this.props.actions.getAllGroupsAssociatedToChannel(this.props.currentChannelId, false, true),
        ]).then(() => {
            this.setGroupsLoadingState(false);
        });
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.searchTerm !== prevProps.searchTerm) {
            clearTimeout(this.searchTimeoutId);

            const searchTerm = this.props.searchTerm;
            if (searchTerm === '') {
                return;
            }

            this.searchTimeoutId = window.setTimeout(
                async () => {
                    this.setGroupsLoadingState(true);
                    await this.props.actions.getGroupsNotAssociatedToChannel(this.props.currentChannelId, searchTerm, undefined, undefined, true);
                    this.setGroupsLoadingState(false);
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );
        }
    }

    handleHide = () => {
        this.props.actions.setModalSearchTerm('');
        this.setState({show: false});
    };

    handleResponse = (err?: ServerError) => {
        let addError = null;
        if (err && err.message) {
            addError = err.message;
        }

        this.setState({
            saving: false,
            addError,
        });
    };

    handleSubmit = async () => {
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
            const {error} = await this.props.actions.linkGroupSyncable(groupID, this.props.currentChannelId, SyncableType.Channel, {auto_add: true});
            this.handleResponse(error);
            if (!error) {
                this.handleHide();
            }
        }));
    };

    addValue = (value: GroupValue) => {
        const values = Object.assign([], this.state.values);
        const userIds = values.map((v: Group) => v.id);
        if (value && value.id && userIds.indexOf(value.id) === -1) {
            values.push(value);
        }

        this.setState({values});
    };

    setGroupsLoadingState = (loadingState: boolean) => {
        this.setState({
            loadingGroups: loadingState,
        });
    };

    handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            this.setGroupsLoadingState(true);
            this.props.actions.getGroupsNotAssociatedToChannel(this.props.currentChannelId, this.props.searchTerm, page, GROUPS_PER_PAGE + 1, true).then(() => {
                this.setGroupsLoadingState(false);
            });
        }
    };

    handleDelete = (values: GroupValue[]) => {
        this.setState({values});
    };

    search = (term: string) => {
        this.props.actions.setModalSearchTerm(term);
    };

    renderOption = (option: GroupValue, isSelected: boolean, onAdd: (value: GroupValue) => void, onMouseMove?: (value: GroupValue) => void) => {
        const rowSelected = isSelected ? 'more-modal__row--selected' : '';

        return (
            <div
                key={option.id}
                ref={isSelected ? this.selectedItemRef : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
                onMouseMove={() => (onMouseMove ? onMouseMove(option) : undefined)}
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
                        {option.display_name}{'\u00A0-\u00A0'}<span className='more-modal__name_sub'>
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
                    <button
                        className='more-modal__actions--round'
                        aria-label='Add groups to channel'
                    >
                        <i className='icon icon-plus'/>
                    </button>
                </div>
            </div>
        );
    };

    renderValue(props: { data: Partial<Value> }) {
        return props.data.display_name;
    }

    render() {
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

        const buttonSubmitText = defineMessage({id: 'multiselect.add', defaultMessage: 'Add'});
        const buttonSubmitLoadingText = defineMessage({id: 'multiselect.adding', defaultMessage: 'Adding...'});

        let addError = null;
        if (this.state.addError) {
            addError = (<div className='has-error col-sm-12'><label className='control-label font-weight--normal'>{this.state.addError}</label></div>);
        }
        let groupsToShow = this.props.groups;
        if (this.props.excludeGroups) {
            const hasGroup = (og: Group) => !this.props.excludeGroups!.find((g) => g.id === og.id);
            groupsToShow = groupsToShow.filter(hasGroup);
        }
        if (this.props.includeGroups) {
            const hasGroup = (og: Group) => this.props.includeGroups!.find((g) => g.id === og.id);
            groupsToShow = [...groupsToShow, ...this.props.includeGroups.filter(hasGroup)];
        }
        const groupsToShowValues = groupsToShow.map((group) => {
            return {label: group.display_name, value: group.id, ...group};
        });

        return (
            <Modal
                id='addGroupsToChannelModal'
                dialogClassName={'a11y__modal more-modal more-direct-channels'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.props.onExited}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title componentClass='h1'>
                        <FormattedMessage
                            id='add_groups_to_channel.title'
                            defaultMessage='Add New Groups to {channelName} Channel'
                            values={{
                                channelName: (
                                    <strong>{this.props.currentChannelName}</strong>
                                ),
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {addError}
                    <MultiSelect
                        key='addGroupsToChannelKey'
                        options={groupsToShowValues}
                        optionRenderer={this.renderOption}
                        intl={this.props.intl}
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
                        placeholderText={defineMessage({id: 'multiselect.addGroupsPlaceholder', defaultMessage: 'Search and add groups'})}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}

export default injectIntl(AddGroupsToChannelModal);
