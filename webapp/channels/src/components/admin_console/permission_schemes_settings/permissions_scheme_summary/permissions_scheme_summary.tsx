// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import type {Scheme} from '@mattermost/types/schemes';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';
import WithTooltip from 'components/with_tooltip';

const MAX_TEAMS_PER_SCHEME_SUMMARY = 8;

export type Props = {
    scheme: Scheme;
    teams?: Team[];
    isDisabled?: boolean;
    actions?: {
        deleteScheme: (id: string) => Promise<ActionResult>;
    };
}

type State = {
    showConfirmModal: boolean;
    deleting: boolean;
    serverError?: string;
}

export default class PermissionsSchemeSummary extends React.PureComponent<Props & RouteComponentProps, State> {
    constructor(props: Props & RouteComponentProps) {
        super(props);
        this.state = {
            showConfirmModal: false,
            deleting: false,
            serverError: undefined,
        };
    }

    renderConfirmModal = () => {
        const title = (
            <FormattedMessage
                id='admin.permissions.permissionsSchemeSummary.deleteSchemeTitle'
                defaultMessage='Delete {scheme} scheme?'
                values={{scheme: this.props.scheme.display_name}}
            />
        );

        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='permission-scheme-summary-error-message'>
                    <i className='fa fa-exclamation-circle'/> {this.state.serverError}
                </div>
            );
        }

        const message = (
            <div>
                <p>
                    <FormattedMessage
                        id='admin.permissions.permissionsSchemeSummary.deleteConfirmQuestion'
                        defaultMessage='The permissions in the teams using this scheme will reset to the defaults in the System Scheme. Are you sure you want to delete the {schemeName} scheme?'
                        values={{schemeName: this.props.scheme.display_name}}
                    />
                </p>
                {serverError}
            </div>
        );

        const confirmButton = (
            <LoadingWrapper
                loading={this.state.deleting}
                text={defineMessage({id: 'admin.permissions.permissionsSchemeSummary.deleting', defaultMessage: 'Deleting...'})}
            >
                <FormattedMessage
                    id='admin.permissions.permissionsSchemeSummary.deleteConfirmButton'
                    defaultMessage='Yes, Delete'
                />
            </LoadingWrapper>
        );

        return (
            <ConfirmModal
                show={this.state.showConfirmModal}
                title={title}
                message={message}
                confirmButtonText={confirmButton}
                onConfirm={this.handleDeleteConfirmed}
                onCancel={this.handleDeleteCanceled}
            />
        );
    };

    stopPropagation = (e: React.MouseEvent<HTMLElement, MouseEvent>): void => {
        e.stopPropagation();
    };

    handleDeleteCanceled = (): void => {
        this.setState({
            showConfirmModal: false,
        });
    };

    handleDeleteConfirmed = async (): Promise<void> => {
        this.setState({deleting: true, serverError: undefined});
        const data = await this.props.actions?.deleteScheme(this.props.scheme.id);
        if (data?.error) {
            this.setState({deleting: false, serverError: data.error.message});
        } else {
            this.setState({deleting: false, showConfirmModal: false});
        }
    };

    delete = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        e.stopPropagation();
        if (this.props.isDisabled) {
            return;
        }
        this.setState({showConfirmModal: true, serverError: undefined});
    };

    goToEdit = (): void => {
        this.props.history.push('/admin_console/user_management/permissions/team_override_scheme/' + this.props.scheme.id);
    };

    render = () => {
        const {scheme, isDisabled} = this.props;

        let teams = this.props.teams ? this.props.teams.map((team) => (
            <span
                className='team'
                key={team.id}
            >
                {team.display_name}
            </span>
        )) : [];

        let extraTeams = null;
        if (teams.length > MAX_TEAMS_PER_SCHEME_SUMMARY) {
            extraTeams = (
                <WithTooltip
                    title={this.props?.teams?.slice(MAX_TEAMS_PER_SCHEME_SUMMARY).map((team) => team.display_name).join(', ') ?? ''}
                >
                    <span
                        className='team'
                        key='extra-teams'
                    >
                        <FormattedMessage
                            id='admin.permissions.permissionsSchemeSummary.moreTeams'
                            defaultMessage='+{number} more'
                            values={{number: teams.length - MAX_TEAMS_PER_SCHEME_SUMMARY}}
                        />
                    </span>
                </WithTooltip>
            );
            teams = teams.slice(0, MAX_TEAMS_PER_SCHEME_SUMMARY);
        }
        const confirmModal = this.renderConfirmModal();

        return (
            <div
                className='permissions-scheme-summary'
                data-testid='permissions-scheme-summary'
                onClick={this.goToEdit}
            >
                <div onClick={this.stopPropagation}>{confirmModal}</div>
                <div
                    className='permissions-scheme-summary--header'
                >
                    <div className='title'>
                        {scheme.display_name}
                    </div>
                    <div className='actions'>
                        <Link
                            data-testid={`${scheme.display_name}-edit`}
                            className='edit-button'
                            to={'/admin_console/user_management/permissions/team_override_scheme/' + scheme.id}
                        >
                            <FormattedMessage
                                id='admin.permissions.permissionsSchemeSummary.edit'
                                defaultMessage='Edit'
                            />
                        </Link>
                        {'-'}
                        <a
                            data-testid={`${scheme.display_name}-delete`}
                            className={isDisabled ? 'delete-button disabled' : 'delete-button'}
                            onClick={this.delete}
                        >
                            <FormattedMessage
                                id='admin.permissions.permissionsSchemeSummary.delete'
                                defaultMessage='Delete'
                            />
                        </a>
                    </div>
                </div>
                <div className='permissions-scheme-summary--description'>
                    {scheme.description}
                </div>
                <div className='permissions-scheme-summary--teams'>
                    {teams}
                    {extraTeams}
                </div>
            </div>
        );
    };
}
