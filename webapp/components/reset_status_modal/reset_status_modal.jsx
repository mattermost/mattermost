// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ConfirmModal from 'components/confirm_modal.jsx';

import {toTitleCase} from 'utils/utils.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';
import {Preferences} from 'mattermost-redux/constants';

export default class ResetStatusModal extends React.PureComponent {
    static propTypes = {

        /*
         * The user's preference for whether their status is automatically reset
         */
        autoResetPref: PropTypes.string,
        actions: PropTypes.shape({

            /*
             * Function to get and then reset the user's status if needed
             */
            autoResetStatus: PropTypes.func.isRequired,

            /*
             * Function to set the status for a user
             */
            setStatus: PropTypes.func.isRequired,

            /*
             * Function to save user preferences
             */
            savePreferences: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            show: false,
            currentUserStatus: {}
        };
    }

    componentDidMount() {
        this.props.actions.autoResetStatus().then(
            (status) => {
                const statusIsManual = status.manual;
                const autoResetPrefNotSet = this.props.autoResetPref === '';

                this.setState({
                    currentUserStatus: status, // Set in state until status refactor where we store 'manual' field in redux
                    show: Boolean(statusIsManual && autoResetPrefNotSet)
                });
            }
        );
    }

    onConfirm = (checked) => {
        this.setState({show: false});

        const newStatus = {...this.state.currentUserStatus};
        newStatus.status = 'online';
        this.props.actions.setStatus(newStatus);

        if (checked) {
            const pref = {category: Preferences.CATEGORY_AUTO_RESET_MANUAL_STATUS, user_id: newStatus.user_id, name: newStatus.user_id, value: 'true'};
            this.props.actions.savePreferences(pref.user_id, [pref]);
        }
    }

    onCancel = (checked) => {
        this.setState({show: false});

        if (checked) {
            const status = {...this.state.currentUserStatus};
            const pref = {category: Preferences.CATEGORY_AUTO_RESET_MANUAL_STATUS, user_id: status.user_id, name: status.user_id, value: 'false'};
            this.props.actions.savePreferences(pref.user_id, [pref]);
        }
    }

    render() {
        const userStatus = toTitleCase(this.state.currentUserStatus.status || '');
        const manualStatusTitle = (
            <FormattedMessage
                id='modal.manaul_status.title'
                defaultMessage='Your status is set to "{status}"'
                values={{
                    status: userStatus
                }}
            />
        );

        const manualStatusMessage = (
            <FormattedMessage
                id='modal.manaul_status.message'
                defaultMessage='Would you like to switch your status to "Online"?'
            />
        );

        const manualStatusButton = (
            <FormattedMessage
                id='modal.manaul_status.button'
                defaultMessage='Yes, set my status to "Online"'
            />
        );

        const manualStatusCancel = (
            <FormattedMessage
                id='modal.manaul_status.cancel'
                defaultMessage='No, keep it as "{status}"'
                values={{
                    status: userStatus
                }}
            />
        );

        const manualStatusCheckbox = (
            <FormattedMessage
                id='modal.manaul_status.ask'
                defaultMessage='Do not ask me again'
            />
        );

        return (
            <ConfirmModal
                show={this.state.show}
                title={manualStatusTitle}
                message={manualStatusMessage}
                confirmButtonText={manualStatusButton}
                onConfirm={this.onConfirm}
                cancelButtonText={manualStatusCancel}
                onCancel={this.onCancel}
                showCheckbox={true}
                checkboxText={manualStatusCheckbox}
            />
        );
    }
}
