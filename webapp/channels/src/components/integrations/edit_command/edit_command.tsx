// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import LoadingScreen from 'components/loading_screen';

import {getHistory} from 'utils/browser_history';

import AbstractCommand from '../abstract_command';

const messages = defineMessages({
    footer: {
        id: 'edit_command.update',
        defaultMessage: 'Update',
    },
    header: {
        id: 'integrations.edit',
        defaultMessage: 'Edit',
    },
    loading: {
        id: 'edit_command.updating',
        defaultMessage: 'Updating...',
    },
});

type Props = {

    /**
    * The current team
    */
    team: Team;

    /**
    * The id of the command to edit
    */
    commandId: string | null;

    /**
    * Installed slash commands to display
    */
    commands: RelationOneToOne<Command, Command>;
    actions: {

        /**
        * The function to call to fetch team commands
        */
        getCustomTeamCommands: (teamId: string) => Promise<ActionResult>;

        /**
        * The function to call to edit command
        */
        editCommand: (command: Command) => Promise<ActionResult>;
    };

    /**
    * Whether or not commands are enabled.
    */
    enableCommands: boolean;
}

type State = {
    originalCommand: Command | null;
    showConfirmModal: boolean;
    serverError: string;
}

export default class EditCommand extends React.PureComponent<Props, State> {
    private newCommand?: Command;

    public constructor(props: Props) {
        super(props);
        this.newCommand = undefined;

        this.state = {
            originalCommand: null,
            showConfirmModal: false,
            serverError: '',
        };
    }

    public componentDidMount(): void {
        if (this.props.enableCommands) {
            this.props.actions.getCustomTeamCommands(this.props.team.id).then(
                () => {
                    this.setState({
                        originalCommand: Object.values(this.props.commands).filter((command) => command.id === this.props.commandId)[0],
                    });
                },
            );
        }
    }

    public editCommand = async (command: Command): Promise<void> => {
        this.newCommand = command;

        if (this.state.originalCommand?.id) {
            command.id = this.state.originalCommand.id;
        }

        if (this.state.originalCommand?.url !== this.newCommand.url ||
            this.state.originalCommand?.trigger !== this.newCommand.trigger ||
            this.state.originalCommand?.method !== this.newCommand.method) {
            this.handleConfirmModal();
        } else {
            await this.submitCommand();
        }
    };

    public handleConfirmModal = (): void => {
        this.setState({showConfirmModal: true});
    };

    public confirmModalDismissed = (): void => {
        this.setState({showConfirmModal: false});
    };

    public submitCommand = async (): Promise<void> => {
        this.setState({serverError: ''});

        const {data, error} = await this.props.actions.editCommand(this.newCommand!);

        if (data) {
            getHistory().push(`/${this.props.team.name}/integrations/commands`);
            return;
        }

        this.setState({showConfirmModal: false});

        if (error) {
            this.setState({serverError: error.message});
        }
    };

    public renderExtra = (): JSX.Element => {
        const confirmButton = (
            <FormattedMessage
                id='update_command.update'
                defaultMessage='Update'
            />
        );

        const confirmTitle = (
            <FormattedMessage
                id='update_command.confirm'
                defaultMessage='Edit Slash Command'
            />
        );

        const confirmMessage = (
            <FormattedMessage
                id='update_command.question'
                defaultMessage='Your changes may break the existing slash command. Are you sure you would like to update it?'
            />
        );

        return (
            <ConfirmModal
                title={confirmTitle}
                message={confirmMessage}
                confirmButtonText={confirmButton}
                modalClass='integrations-backstage-modal'
                show={this.state.showConfirmModal}
                onConfirm={this.submitCommand}
                onCancel={this.confirmModalDismissed}
            />
        );
    };

    public render(): JSX.Element {
        if (!this.state.originalCommand) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractCommand
                team={this.props.team}
                header={messages.header}
                footer={messages.footer}
                loading={messages.loading}
                renderExtra={this.renderExtra()}
                action={this.editCommand}
                serverError={this.state.serverError}
                initialCommand={this.state.originalCommand}
            />
        );
    }
}
