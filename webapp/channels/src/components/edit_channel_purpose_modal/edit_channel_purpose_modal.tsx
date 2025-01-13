// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
}
type ServerError = {
    message: string;
}
const purposeMaxLength = 250;

type Props = {
    onExited: () => void;
    channel?: Channel;
    ctrlSend: boolean;
    actions: Actions;
    intl: IntlShape;
}

type State = {
    purpose: string;
    serverError: ServerError | null;
    show: boolean;
    submitted: boolean;
    requestStarted: boolean;
}

export class EditChannelPurposeModal extends React.PureComponent<Props, State> {
    private purpose: React.RefObject<HTMLTextAreaElement>;

    constructor(props: Props) {
        super(props);
        this.purpose = React.createRef();

        this.state = {
            purpose: props.channel?.purpose || '',
            serverError: null,
            show: true,
            submitted: false,
            requestStarted: false,
        };
    }

    handleEntering = () => {
        if (this.purpose.current) {
            Utils.placeCaretAtEnd(this.purpose.current);
        }
    };

    onHide = () => {
        this.setState({show: false});
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        const {ctrlSend} = this.props;

        // listen for line break key combo and insert new line character
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            e.preventDefault();
            this.setState({purpose: Utils.insertLineBreakFromKeyEvent(e.nativeEvent)});
        } else if (ctrlSend && Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && e.ctrlKey) {
            e.preventDefault();
            this.handleSave();
        } else if (!ctrlSend && Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.handleSave();
        }
    };

    handleSave = async () => {
        const {channel, actions: {patchChannel}} = this.props;
        const {purpose} = this.state;
        if (!channel) {
            return;
        }

        this.setState({requestStarted: true});

        const {data, error} = await patchChannel(channel.id, {purpose});

        this.setState({
            serverError: error,
            requestStarted: false,
        });

        if (data) {
            this.onHide();
        }
    };

    handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        this.setState({purpose: e.target.value});
    };

    render() {
        let serverError = null;
        const {formatMessage} = this.props.intl;

        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
                    <br/>
                    <label className='control-label'>{this.state.serverError.message}</label>
                </div>
            );
        }

        let title = (
            <span>
                <FormattedMessage
                    id='edit_channel_purpose_modal.title1'
                    defaultMessage='Edit Purpose'
                />
            </span>
        );
        if (this.props.channel?.display_name) {
            title = (
                <span>
                    <FormattedMessage
                        id='edit_channel_purpose_modal.title2'
                        defaultMessage='Edit Purpose for '
                    />
                    <span className='name'>{this.props.channel.display_name}</span>
                </span>
            );
        }

        let channelPurposeModal = (
            <FormattedMessage
                id='edit_channel_purpose_modal.body'
                defaultMessage='Describe how this channel should be used. This text appears in the channel list in the "More..." menu and helps others decide whether to join.'
            />
        );
        if (this.props.channel?.type === 'P') {
            channelPurposeModal = (
                <FormattedMessage
                    id='edit_channel_private_purpose_modal.body'
                    defaultMessage='This text appears in the \"View Info\" modal of the private channel.'
                />
            );
        }

        const ariaLabelForTitle = formatMessage({id: 'edit_channel_purpose_modal.title1', defaultMessage: 'Edit Purpose'}).toLowerCase();
        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onEntering={this.handleEntering}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='editChannelPurposeModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='editChannelPurposeModalLabel'
                    >
                        {title}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        {channelPurposeModal}
                    </p>
                    <textarea
                        ref={this.purpose}
                        className='form-control no-resize'
                        rows={6}
                        maxLength={purposeMaxLength}
                        value={this.state.purpose}
                        onKeyDown={this.handleKeyDown}
                        onChange={this.handleChange}
                        aria-label={ariaLabelForTitle}
                    />
                    {serverError}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-tertiary cancel-button'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='edit_channel_purpose_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        disabled={this.state.requestStarted}
                        onClick={this.handleSave}
                    >
                        <FormattedMessage
                            id='edit_channel_purpose_modal.save'
                            defaultMessage='Save'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default injectIntl(EditChannelPurposeModal);
