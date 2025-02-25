// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import type {WrappedComponentProps} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import Textbox, {TextboxLinks} from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {isMobile} from 'utils/user_agent';
import {insertLineBreakFromKeyEvent, isUnhandledLineBreakKeyCombo} from 'utils/utils';

import type {PropsFromRedux} from './index';

const KeyCodes = Constants.KeyCodes;

const headerMaxLength = 1024;

type OwnProps = {

    /**
     * Called when the modal has been hidden and should be removed.
     */
    onExited: () => void;

    /*
     * Object with info about current channel ,
     */
    channel: Channel;
};

type Props = OwnProps & PropsFromRedux & WrappedComponentProps;

type State = {
    header?: string;
    saving: boolean;
    show: boolean;
    serverError?: ServerError | null;
    postError?: React.ReactNode;
}

export class EditChannelHeaderModal extends React.PureComponent<Props, State> {
    private editChannelHeaderTextboxRef: React.RefObject<TextboxClass>;

    constructor(props: Props) {
        super(props);

        this.state = {
            header: props.channel.header,
            saving: false,
            show: true,
        };
        this.editChannelHeaderTextboxRef = React.createRef<TextboxClass>();
    }

    private handleModalKeyDown = (e: React.KeyboardEvent<Modal>): void => {
        if (isKeyPressed(e as unknown as React.KeyboardEvent, KeyCodes.ESCAPE)) {
            this.hideModal();
        }
    };

    private setShowPreview = (newState: boolean): void => {
        this.props.actions.setShowPreview(newState);
    };

    private handleChange = (e: React.ChangeEvent<TextboxElement>): void => {
        const isInvalidLength = e.target.value.length > headerMaxLength;
        if (isInvalidLength) {
            this.setState({
                header: e.target.value,
                serverError: {
                    server_error_id: 'model.channel.is_valid.header.app_error',
                    message: 'Invalid header length',
                },
            });
        } else {
            this.setState({
                header: e.target.value,
                serverError: null,
            });
        }
    };

    public handleSave = async (): Promise<void> => {
        const header = this.state.header?.trim() ?? '';
        if (header === this.props.channel.header) {
            this.hideModal();
        } else {
            this.setState({saving: true});
            const {channel, actions} = this.props;
            const {error} = await actions.patchChannel(channel.id!, {header});
            if (error) {
                this.setState({serverError: error, saving: false});
            } else {
                this.hideModal();
            }
        }
    };

    private hideModal = (): void => {
        this.setState({
            show: false,
        });
    };

    private focusTextbox = (): void => {
        if (this.editChannelHeaderTextboxRef.current) {
            this.editChannelHeaderTextboxRef.current.focus();
        }
    };

    private blurTextbox = (): void => {
        if (this.editChannelHeaderTextboxRef.current) {
            this.editChannelHeaderTextboxRef.current.blur();
        }
    };

    private handleEntering = (): void => {
        this.focusTextbox();
    };

    private handleKeyDown = (e: React.KeyboardEvent<Element>): void => {
        const {ctrlSend} = this.props;

        // listen for line break key combo and insert new line character
        if (isUnhandledLineBreakKeyCombo(e)) {
            this.setState({header: insertLineBreakFromKeyEvent(e.nativeEvent)});
        } else if (ctrlSend && isKeyPressed(e, KeyCodes.ENTER) && e.ctrlKey === true) {
            this.handleKeyPress(e);
        }
    };

    private handleKeyPress = (e: React.KeyboardEvent<Element>): void => {
        const {ctrlSend} = this.props;
        if (!isMobile() && ((ctrlSend && e.ctrlKey) || !ctrlSend)) {
            if (isKeyPressed(e, KeyCodes.ENTER) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                this.blurTextbox();
                this.handleSave();
            }
        }
    };

    private handlePostError = (postError: React.ReactNode) => {
        this.setState({postError});
    };

    private renderError = (): (JSX.Element | null) => {
        const {serverError} = this.state;
        if (!serverError) {
            return null;
        }

        let errorMsg;
        if (serverError.server_error_id === 'model.channel.is_valid.header.app_error') {
            errorMsg = (
                <FormattedMessage
                    id='edit_channel_header_modal.error'
                    defaultMessage='The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.'
                    values={{
                        maxLength: headerMaxLength,
                    }}
                />
            );
        } else {
            errorMsg = serverError.message;
        }

        return (
            <div className='form-group has-error'>
                <br/>
                <label className='control-label'>
                    {errorMsg}
                </label>
            </div>
        );
    };

    public render(): JSX.Element {
        let headerTitle = null;
        if (this.props.channel.type === Constants.DM_CHANNEL) {
            headerTitle = (
                <FormattedMessage
                    id='edit_channel_header_modal.title_dm'
                    defaultMessage='Edit Header'
                />
            );
        } else {
            headerTitle = (
                <FormattedMessage
                    id='edit_channel_header_modal.title'
                    defaultMessage='Edit Header for {channel}'
                    values={{
                        channel: this.props.channel.display_name,
                    }}
                />
            );
        }

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                keyboard={false}
                onKeyDown={this.handleModalKeyDown}
                onHide={this.hideModal}
                onEntering={this.handleEntering}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='editChannelHeaderModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='editChannelHeaderModalLabel'
                    >
                        {headerTitle}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body bsClass='modal-body edit-modal-body'>
                    <div>
                        <label
                            htmlFor='edit_textbox'
                            className='textarea-label'
                        >
                            <FormattedMessage
                                id='edit_channel_header_modal.description'
                                defaultMessage='Edit the text appearing next to the channel name in the header.'
                            />
                        </label>
                        <div className='textarea-wrapper'>
                            <Textbox
                                value={this.state.header!}
                                onChange={this.handleChange}
                                onKeyPress={this.handleKeyPress}
                                onKeyDown={this.handleKeyDown}
                                supportsCommands={false}
                                suggestionListPosition='bottom'
                                createMessage={this.props.intl.formatMessage({id: 'edit_channel_header_modal.placeholder', defaultMessage: 'Enter the Channel Header'})}
                                handlePostError={this.handlePostError}
                                channelId={this.props.channel.id!}
                                id='edit_textbox'
                                ref={this.editChannelHeaderTextboxRef}
                                characterLimit={headerMaxLength}
                                preview={this.props.shouldShowPreview}
                                useChannelMentions={false}
                            />
                        </div>
                        <div className='post-create-footer'>
                            <TextboxLinks
                                showPreview={this.props.shouldShowPreview}
                                updatePreview={this.setShowPreview}
                                hasText={this.state.header ? this.state.header.length > 0 : false}
                                hasExceededCharacterLimit={this.state.header ? this.state.header.length > headerMaxLength : false}
                                previewMessageLink={
                                    <FormattedMessage
                                        id='edit_channel_header_modal.previewHeader'
                                        defaultMessage='Edit'
                                    />
                                }
                            />
                        </div>
                        {this.renderError()}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-tertiary cancel-button'
                        onClick={this.hideModal}
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        disabled={this.state.saving}
                        type='button'
                        className='btn btn-primary save-button'
                        onClick={this.handleSave}
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.save'
                            defaultMessage='Save'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default injectIntl(EditChannelHeaderModal);
