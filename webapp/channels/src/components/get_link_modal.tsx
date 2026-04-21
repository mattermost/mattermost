// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

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

export default class GetLinkModal extends React.PureComponent<Props, State> {
    private textAreaRef = React.createRef<HTMLTextAreaElement>();
    private resetTimeout: NodeJS.Timeout | null = null;
    public static defaultProps = {
        helpText: null,
    };

    public constructor(props: Props) {
        super(props);
        this.state = {
            copiedLink: false,
        };
    }

    public componentWillUnmount(): void {
        if (this.resetTimeout) {
            clearTimeout(this.resetTimeout);
        }
    }

    public onHide = (): void => {
        if (this.resetTimeout) {
            clearTimeout(this.resetTimeout);
        }
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
                if (this.resetTimeout) {
                    clearTimeout(this.resetTimeout);
                }
                this.resetTimeout = setTimeout(() => {
                    this.setState({copiedLink: false});
                }, 1000);
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
                    id='linkModalCopyLink'
                    data-copy-btn='true'
                    type='button'
                    emphasis='primary'
                    className={classNames({
                        'btn-success': this.state.copiedLink,
                    }, 'pull-left')}
                    onClick={this.copyLink}
                >
                    {this.state.copiedLink ? (
                        <>
                            <i className='icon icon-check'/>
                            <FormattedMessage
                                id='get_link.clipboard'
                                defaultMessage='Copied'
                            />
                        </>
                    ) : (
                        <>
                            <i className='icon icon-link-variant'/>
                            <FormattedMessage
                                id='get_link.copy'
                                defaultMessage='Copy Link'
                            />
                        </>
                    )}
                </Button>
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

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.props.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='getLinkModalLabel'
            >
                <Modal.Header
                    id='getLinkModalLabel'
                    closeButton={true}
                >
                    <h2 className='modal-title'>{this.props.title}</h2>
                </Modal.Header>
                <Modal.Body>
                    {helpText}
                    {linkText}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        id='linkModalCloseButton'
                        type='button'
                        emphasis='tertiary'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='get_link.close'
                            defaultMessage='Close'
                        />
                    </Button>
                    {copyLink}
                </Modal.Footer>
            </Modal>
        );
    }
}
