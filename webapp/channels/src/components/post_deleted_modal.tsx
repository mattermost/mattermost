// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

type Props = {
    onExited: () => void;
}

type State = {
    show: boolean;
}

export default class PostDeletedModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    private handleHide = () => {
        this.setState({show: false});
    }

    public render(): JSX.Element {
        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='postDeletedModalLabel'
                data-testid='postDeletedModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='postDeletedModalLabel'
                    >
                        <FormattedMessage
                            id='post_delete.notPosted'
                            defaultMessage='Comment could not be posted'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        <FormattedMessage
                            id='post_delete.someone'
                            defaultMessage='Someone deleted the message on which you tried to post a comment.'
                        />
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-primary'
                        autoFocus={true}
                        onClick={this.handleHide}
                        data-testid='postDeletedModalOkButton'
                    >
                        <FormattedMessage
                            id='post_delete.okay'
                            defaultMessage='Okay'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
