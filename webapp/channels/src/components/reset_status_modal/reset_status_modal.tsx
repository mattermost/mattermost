// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserStatus} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';

import {UserStatuses} from 'utils/constants';

const messages: Record<string, Record<string, MessageDescriptor>> = {
    away: defineMessages({
        auto_responder_message: {
            id: 'modal.manual_status.auto_responder.message_away',
            defaultMessage: 'Would you like to switch your status to "Away" and disable Automatic Replies?',
        },
        button: {
            id: 'modal.manual_status.button_away',
            defaultMessage: 'Yes, set my status to "Away"',
        },
        cancel: {
            id: 'modal.manual_status.cancel_away',
            defaultMessage: 'No, keep it as "Away"',
        },
        message: {
            id: 'modal.manual_status.message_away',
            defaultMessage: 'Would you like to switch your status to "Away"?',
        },
        title: {
            id: 'modal.manual_status.title_away',
            defaultMessage: 'Your Status is Set to "Away"',
        },
    }),
    dnd: defineMessages({
        auto_responder_message: {
            id: 'modal.manual_status.auto_responder.message_dnd',
            defaultMessage: 'Would you like to switch your status to "Do Not Disturb" and disable Automatic Replies?',
        },
        button: {
            id: 'modal.manual_status.button_dnd',
            defaultMessage: 'Yes, set my status to "Do Not Disturb"',
        },
        cancel: {
            id: 'modal.manual_status.cancel_dnd',
            defaultMessage: 'No, keep it as "Do Not Disturb"',
        },
        message: {
            id: 'modal.manual_status.message_dnd',
            defaultMessage: 'Would you like to switch your status to "Do Not Disturb"?',
        },
        title: {
            id: 'modal.manual_status.title_dnd',
            defaultMessage: 'Your Status is Set to "Do Not Disturb"',
        },
    }),
    offline: defineMessages({
        auto_responder_message: {
            id: 'modal.manual_status.auto_responder.message_offline',
            defaultMessage: 'Would you like to switch your status to "Offline" and disable Automatic Replies?',
        },
        button: {
            id: 'modal.manual_status.button_offline',
            defaultMessage: 'Yes, set my status to "Offline"',
        },
        cancel: {
            id: 'modal.manual_status.cancel_offline',
            defaultMessage: 'No, keep it as "Offline"',
        },
        message: {
            id: 'modal.manual_status.message_offline',
            defaultMessage: 'Would you like to switch your status to "Offline"?',
        },
        title: {
            id: 'modal.manual_status.title_offline',
            defaultMessage: 'Your Status is Set to "Offline"',
        },
    }),
    online: defineMessages({
        auto_responder_message: {
            id: 'modal.manual_status.auto_responder.message_online',
            defaultMessage: 'Would you like to switch your status to "Online" and disable Automatic Replies?',
        },
        button: {
            id: 'modal.manual_status.button_online',
            defaultMessage: 'Yes, set my status to "Online"',
        },
        message: {
            id: 'modal.manual_status.message_online',
            defaultMessage: 'Would you like to switch your status to "Online"?',
        },
    }),
    ooo: defineMessages({
        cancel: {
            id: 'modal.manual_status.cancel_ooo',
            defaultMessage: 'No, keep it as "Out of Office"',
        },
        title: {
            id: 'modal.manual_status.title_ooo',
            defaultMessage: 'Your Status is Set to "Out of Office"',
        },
    }),
};

type Props = {

    /*
     * The user's preference for whether their status is automatically reset
     */
    autoResetPref?: string;

    /*
     * Props value is used to update currentUserStatus
     */
    currentUserStatus?: string;

    /*
     * Props value is used to reset status from status_dropdown
     */
    newStatus?: string;

    /*
     * Function called when modal is dismissed
     */
    onHide?: () => void;

    /**
         * Function called after the modal has been hidden
         */
    onExited?: () => void;

    actions: {

        /*
         * Function to get and then reset the user's status if needed
         */
        autoResetStatus: () => Promise<ActionResult<UserStatus>>;

        /*
         * Function to set the status for a user
         */
        setStatus: (status: UserStatus) => void;

        /*
         * Function to save user preferences
         */
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
}

type State = {
    show: boolean;
    currentUserStatus: UserStatus;
    newStatus: string;
}

export default class ResetStatusModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: false,
            currentUserStatus: {} as UserStatus,
            newStatus: props.newStatus || 'online',
        };
    }

    public componentDidMount(): void {
        this.props.actions.autoResetStatus().then(
            (result) => {
                if (result.data! === null) {
                    return;
                }
                const status = result.data!;
                const statusIsManual = status?.manual;
                const autoResetPrefNotSet = this.props.autoResetPref === '';

                this.setState({
                    currentUserStatus: status, // Set in state until status refactor where we store 'manual' field in redux
                    show: Boolean(status?.status === UserStatuses.OUT_OF_OFFICE || (statusIsManual && autoResetPrefNotSet)),
                });
            },
        );
    }

    private hideModal = (): void => this.setState({show: false});

    public onConfirm = (checked: boolean): void => {
        this.hideModal();

        const newStatus = {...this.state.currentUserStatus};
        newStatus.status = this.state.newStatus;
        this.props.actions.setStatus(newStatus);

        if (checked) {
            const pref = {category: Preferences.CATEGORY_AUTO_RESET_MANUAL_STATUS, user_id: newStatus.user_id, name: newStatus.user_id, value: 'true'};
            this.props.actions.savePreferences(pref.user_id, [pref]);
        }
    };

    public onCancel = (checked: boolean): void => {
        this.hideModal();

        if (checked) {
            const status = {...this.state.currentUserStatus};
            const pref = {category: Preferences.CATEGORY_AUTO_RESET_MANUAL_STATUS, user_id: status.user_id, name: status.user_id, value: 'false'};
            this.props.actions.savePreferences(pref.user_id, [pref]);
        }
    };

    private renderModalMessage = () => {
        if (this.props.currentUserStatus === UserStatuses.OUT_OF_OFFICE) {
            return messages[this.state.newStatus] ? (<FormattedMessage {...messages[this.state.newStatus].auto_responder_message}/>) : '';
        }

        return messages[this.state.newStatus] ? (<FormattedMessage {...messages[this.state.newStatus].message}/>) : '';
    };

    public render(): JSX.Element {
        const userStatus = this.state.currentUserStatus?.status || '';
        const manualStatusTitle = messages[userStatus] ? (<FormattedMessage {...messages[userStatus].title}/>) : '';

        const manualStatusMessage = this.renderModalMessage();
        const manualStatusButton = messages[this.state.newStatus] ? (<FormattedMessage {...messages[this.state.newStatus].button}/>) : '';
        const manualStatusCancel = messages[userStatus] ? (<FormattedMessage {...messages[userStatus].cancel}/>) : '';

        const manualStatusCheckbox = (
            <FormattedMessage
                id='modal.manual_status.ask'
                defaultMessage='Do not ask me again'
            />
        );

        const showCheckbox = this.props.currentUserStatus !== UserStatuses.OUT_OF_OFFICE;

        return (
            <ConfirmModal
                show={this.state.show}
                title={manualStatusTitle}
                message={manualStatusMessage}
                confirmButtonText={manualStatusButton}
                onConfirm={this.onConfirm}
                cancelButtonText={manualStatusCancel}
                onCancel={this.onCancel}
                onExited={this.props.onExited}
                showCheckbox={showCheckbox}
                checkboxText={manualStatusCheckbox}
            />
        );
    }
}
