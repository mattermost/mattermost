// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import MultiSelect from 'components/multiselect/multiselect';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {localizeMessage, imageURLForTeam} from 'utils/utils';

import type {Team} from '@mattermost/types/teams';
import type {Value} from 'components/multiselect/multiselect';
import type {ActionResult} from 'mattermost-redux/types/actions';

const TEAMS_PER_PAGE = 50;

type TeamValue = (Team & Value);

export type Props = {
    currentSchemeId?: string;
    alreadySelected?: string[];
    excludeGroupConstrained?: boolean;
    searchTerm: string;
    teams: Team[];
    onModalDismissed?: () => void;
    onTeamsSelected?: (a: Team[]) => void;
    modalID?: string;
    actions: {
        loadTeams: (page?: number, perPage?: number, includeTotalCount?: boolean, excludePolicyConstrained?: boolean) => Promise<ActionResult>;
        setModalSearchTerm: (searchTerm: string) => void;
        searchTeams: (searchTerm: string) => void;
    };
    data?: any;
    excludePolicyConstrained?: boolean;
};

type State = {
    values: TeamValue[];
    show: boolean;
    search: boolean;
    loadingTeams: boolean;
    confirmAddModal: boolean;
    confirmAddTeam: any;
};

export default class TeamSelectorModal extends React.PureComponent<Props, State> {
    private searchTimeoutId?: number;
    private selectedItemRef?: React.RefObject<HTMLDivElement> | undefined;
    private currentSchemeId?: string;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            values: [],
            show: true,
            search: false,
            loadingTeams: true,
            confirmAddModal: false,
            confirmAddTeam: null,
        };

        this.selectedItemRef = React.createRef();
    }

    componentDidMount() {
        this.props.actions.loadTeams(0, TEAMS_PER_PAGE + 1, false, this.props.excludePolicyConstrained).then(() => {
            this.setTeamsLoadingState(false);
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
                    this.setTeamsLoadingState(true);
                    await this.props.actions.searchTeams(searchTerm);
                    this.setTeamsLoadingState(false);
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );
        }
    }

    handleHide = () => {
        this.props.actions.setModalSearchTerm('');
        this.setState({show: false});
    };

    handleExit = () => {
        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    };

    handleSubmit = (e: Event | TeamValue[] | undefined) => {
        if (e) {
            (e as Event).preventDefault();
        }

        if (this.state.values.length === 0) {
            return;
        }

        this.props.onTeamsSelected?.(this.state.values);
        this.handleHide();
    };

    addValue = (value: TeamValue, confirmed = false) => {
        if (this.props.modalID === ModalIdentifiers.ADD_TEAMS_TO_SCHEME && value.scheme_id !== null && value.scheme_id !== '' && !confirmed) {
            this.setState({confirmAddModal: true, confirmAddTeam: value});
            return;
        }
        const values = Object.assign([], this.state.values);
        const teamIds = values.map((v: Team) => v.id);
        if (value && value.id && teamIds.indexOf(value.id) === -1) {
            values.push(value);
        }

        this.setState({values, confirmAddModal: false, confirmAddTeam: null});
    };

    setTeamsLoadingState = (loadingState: boolean) => {
        this.setState({
            loadingTeams: loadingState,
        });
    };

    handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            this.setTeamsLoadingState(true);
            this.props.actions.loadTeams(page, TEAMS_PER_PAGE + 1, false, this.props.excludePolicyConstrained).then(() => {
                this.setTeamsLoadingState(false);
            });
        }
    };

    handleDelete = (values: TeamValue[]) => {
        this.setState({values});
    };

    search = (term: string, multiselectComponent: { state: { page: number }; setState: (arg0: { page: number }) => void }) => {
        if (multiselectComponent.state.page !== 0) {
            multiselectComponent.setState({page: 0});
        }
        this.props.actions.setModalSearchTerm(term);
    };

    renderOption = (option: TeamValue, isSelected: boolean, onAdd: (value: TeamValue) => void, onMouseMove: (value: TeamValue) => void) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        return (
            <div
                key={option.id}
                ref={isSelected ? this.selectedItemRef : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
                onMouseMove={() => onMouseMove(option)}
            >
                <div
                    className='more-modal__details'
                >
                    <div className='team-info-block'>
                        <TeamIcon
                            content={option.display_name}
                            url={imageURLForTeam(option)}
                        />
                        <div className='team-data'>
                            <div className='title'>{option.display_name}</div>
                        </div>
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <div className='more-modal__actions--round'>
                        <i className='fa fa-plus'/>
                    </div>
                </div>
            </div>
        );
    };

    renderValue(props: { data: TeamValue }) {
        return props.data.display_name;
    }

    renderConfirmModal(show: boolean, team: TeamValue) {
        const title = (
            <FormattedMessage
                id='add_teams_to_scheme.confirmation.title'
                defaultMessage='Team Override Scheme Change?'
            />
        );
        const message = (
            <FormattedMessage
                id='add_teams_to_scheme.confirmation.message'
                defaultMessage='This team is already selected in another team scheme, are you sure you want to move it to this team scheme?'
            />
        );
        const confirmButtonText = (
            <FormattedMessage
                id='add_teams_to_scheme.confirmation.accept'
                defaultMessage='Yes, Move Team'
            />
        );
        return (
            <ConfirmModal
                show={show}
                title={title}
                message={message}
                confirmButtonText={confirmButtonText}
                onCancel={() => this.setState({confirmAddModal: false, confirmAddTeam: null})}
                onConfirm={() => this.addValue(team, true)}
            />
        );
    }

    render() {
        const confirmModal = this.renderConfirmModal(this.state.confirmAddModal, this.state.confirmAddTeam);
        const numRemainingText = (
            <FormattedMessage
                id='multiselect.selectTeams'
                defaultMessage='Use ↑↓ to browse, ↵ to select.'
            />
        );

        const buttonSubmitText = localizeMessage('multiselect.add', 'Add');

        let teams = [] as Team[];
        if (this.props.teams) {
            teams = this.props.teams.filter((team) => team.delete_at === 0);
            teams = teams.filter((team) => team.scheme_id !== this.currentSchemeId);
            teams = this.props.excludeGroupConstrained ? teams.filter((team) => !team.group_constrained) : teams;
            if (this.props.alreadySelected) {
                teams = teams.filter((team) => this.props.alreadySelected?.indexOf(team.id) === -1);
            }
            if (this.props.excludePolicyConstrained) {
                teams = teams.filter((team) => team.policy_id === null);
            }
            teams.sort((a, b) => {
                const aName = a.display_name.toUpperCase();
                const bName = b.display_name.toUpperCase();
                if (aName === bName) {
                    return 0;
                }
                if (aName > bName) {
                    return 1;
                }
                return -1;
            });
        }

        const teamsValues = teams.map((team) => {
            return {label: team.name, value: team.id, ...team};
        });

        return (
            <Modal
                dialogClassName='a11y__modal more-modal more-direct-channels team-selector-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                role='dialog'
                aria-labelledby='teamSelectorModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='teamSelectorModalLabel'
                    >
                        <FormattedMarkdownMessage
                            id='add_teams_to_scheme.title'
                            defaultMessage='Add Teams to **Team Selection** List'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {confirmModal}
                    <MultiSelect<TeamValue>
                        key='addTeamsToSchemeKey'
                        options={teamsValues}
                        optionRenderer={this.renderOption}
                        selectedItemRef={this.selectedItemRef}
                        values={this.state.values}
                        valueRenderer={this.renderValue}
                        perPage={TEAMS_PER_PAGE}
                        handlePageChange={this.handlePageChange}
                        handleInput={this.search}
                        handleDelete={this.handleDelete}
                        handleAdd={this.addValue}
                        handleSubmit={this.handleSubmit}
                        numRemainingText={numRemainingText}
                        buttonSubmitText={buttonSubmitText}
                        saving={false}
                        loading={this.state.loadingTeams}
                        placeholderText={localizeMessage('multiselect.addTeamsPlaceholder', 'Search and add teams')}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}
