// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';
import {FormattedMessage, injectIntl, type WrappedComponentProps} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {UserStatus} from '@mattermost/types/users';

import DateTimeInput from 'components/datetime_input/datetime_input';

import Constants, {UserStatuses} from 'utils/constants';
import {toUTCUnixInSeconds, relativeFormatDate} from 'utils/datetime';
import {isKeyPressed} from 'utils/keyboard';
import {localizeMessage} from 'utils/utils';

import './dnd_custom_time_picker_modal.scss';

type Props = {
    onExited: () => void;
    userId: string;
    currentDate: Date;
    locale: string;
    timezone?: string;

    actions: {
        setStatus: (status: UserStatus) => void;
    };
} & WrappedComponentProps;

type State = {
    selectedDateTime: moment.Moment;
}

export default injectIntl(class DndCustomTimePicker extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        const {currentDate} = this.props;
        let selectedDateTime = moment(currentDate);

        // if current time is > 23:20 then we will set date to tomorrow and show all times
        if (currentDate.getHours() === 23 && currentDate.getMinutes() > 20) {
            selectedDateTime = selectedDateTime.add(1, 'day').startOf('day').add(9, 'hours');
        }

        this.state = {
            selectedDateTime,
        };
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = (event: KeyboardEvent) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE)) {
            this.props.onExited();
        }
    };

    formatDate = (date: moment.Moment): string => {
        return relativeFormatDate(date, this.props.intl.formatMessage);
    };

    getText = () => {
        const modalHeaderText = (
            <FormattedMessage
                id='dnd_custom_time_picker_modal.defaultMsg'
                defaultMessage='Disable notifications until'
            />
        );
        const confirmButtonText = (
            <FormattedMessage
                id='dnd_custom_time_picker_modal.submitButton'
                defaultMessage='Disable Notifications'
            />
        );

        return {
            modalHeaderText,
            confirmButtonText,
        };
    };

    handleConfirm = async () => {
        const endTime = this.state.selectedDateTime.toDate();
        if (endTime < new Date()) {
            return;
        }
        await this.props.actions.setStatus({
            user_id: this.props.userId,
            status: UserStatuses.DND,
            dnd_end_time: toUTCUnixInSeconds(endTime),
            manual: true,
            last_activity_at: toUTCUnixInSeconds(this.props.currentDate),
        });
        this.props.onExited();
    };

    handleDateTimeChange = (newDateTime: moment.Moment) => {
        this.setState({
            selectedDateTime: newDateTime,
        });
    };

    render() {
        const {
            modalHeaderText,
            confirmButtonText,
        } = this.getText();

        const {selectedDateTime} = this.state;

        return (
            <GenericModal
                compassDesign={true}
                ariaLabel={localizeMessage({id: 'dnd_custom_time_picker_modal.defaultMsg', defaultMessage: 'Disable notifications until'})}
                onExited={this.props.onExited}
                modalHeaderText={modalHeaderText}
                confirmButtonText={confirmButtonText}
                handleConfirm={this.handleConfirm}
                handleEnterKeyPress={this.handleConfirm}
                id='dndCustomTimePickerModal'
                className={'DndModal modal-overflow'}
                tabIndex={-1}
                keyboardEscape={true}
                enforceFocus={false}
            >
                <div className='DndModal__content'>
                    <DateTimeInput
                        time={selectedDateTime}
                        handleChange={this.handleDateTimeChange}
                        timezone={this.props.timezone}
                        relativeDate={true}
                    />
                </div>
            </GenericModal>
        );
    }
});
