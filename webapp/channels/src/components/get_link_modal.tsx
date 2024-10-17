// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage} from 'react-intl';

import SuccessIcon from 'components/widgets/icons/fa_success_icon';

import Button from './button';

type Props = {
    show: boolean;
    onHide: () => void;
    onExited: () => void;
    title: string;
    helpText?: string;
    link: string;
}

type State = {
    copiedLink: boolean;
}

const messages = defineMessages({
    copyLink: {id: 'get_link.copy', defaultMessage: 'Copy Link'},
    close: {id: 'get_link.close', defaultMessage: 'Close'},
});

export default class GetLinkModal extends React.PureComponent<Props, State> {
    private textAreaRef = React.createRef<HTMLTextAreaElement>();
    public static defaultProps = {
        helpText: null,
    };

    public constructor(props: Props) {
        super(props);
        this.state = {
            copiedLink: false,
        };
    }

    public onHide = (): void => {
        this.setState({copiedLink: false});
        this.props.onHide();
    };

    public copyLink = (): void => {
        const textarea = this.textAreaRef.current;

        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(0, this.props.link.length);

            try {
                this.setState({copiedLink: document.execCommand('copy')});
            } catch (err) {
                this.setState({copiedLink: false});
            }
        }
    };

    public render(): JSX.Element {
        let helpText = null;
        if (this.props.helpText) {
            helpText = (
                <p>
                    {this.props.helpText}
                    <br/>
                    <br/>
                </p>
            );
        }

        let copyLink = null;

        if (document.queryCommandSupported('copy')) {
            copyLink = (
                <Button
                    testId='linkModalCopyLink'
                    emphasis='primary'
                    onClick={this.copyLink}
                    label={messages.copyLink}
                />
            );
        }

        const linkText = (
            <textarea
                id='linkModalTextArea'
                className='form-control no-resize min-height'
                ref={this.textAreaRef}
                dir='auto'
                value={this.props.link}
                onClick={this.copyLink}
                readOnly={true}
            />
        );

        let copyLinkConfirm = null;
        if (this.state.copiedLink) {
            copyLinkConfirm = (
                <p className='alert alert-success alert--confirm'>
                    <SuccessIcon/>
                    <FormattedMessage
                        id='get_link.clipboard'
                        defaultMessage=' Link copied'
                    />
                </p>
            );
        }

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.props.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='getLinkModalLabel'
            >
                <Modal.Header
                    id='getLinkModalLabel'
                    closeButton={true}
                >
                    <h4 className='modal-title'>{this.props.title}</h4>
                </Modal.Header>
                <Modal.Body>
                    {helpText}
                    {linkText}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        testId='linkModalCloseButton'
                        emphasis='tertiary'
                        onClick={this.onHide}
                        label={messages.close}
                    />
                    {copyLink}
                    {copyLinkConfirm}
                </Modal.Footer>
            </Modal>
        );
    }
}
