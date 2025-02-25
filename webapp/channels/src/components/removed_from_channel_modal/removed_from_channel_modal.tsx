// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

type Props = {
    currentUserId: string;
    onExited: () => void;
    channelName?: string;
    remover?: string;
}

type State = {
    show: boolean;
}

export default class RemovedFromChannelModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {show: true};
    }

    onHide = () => {
        this.setState({show: false});
    };

    render() {
        let channelName: JSX.Element | string;
        let remover: JSX.Element | string;

        channelName = (
            <FormattedMessage
                id='removed_channel.channelName'
                defaultMessage='the channel'
            />
        );
        if (this.props.channelName) {
            channelName = this.props.channelName;
        }

        remover = (
            <FormattedMessage
                id='removed_channel.someone'
                defaultMessage='Someone'
            />
        );
        if (this.props.remover) {
            remover = this.props.remover;
        }

        if (this.props.currentUserId === '') {
            return null;
        }

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='removeFromChannelModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='removeFromChannelModalLabel'
                    >
                        <FormattedMessage
                            id='removed_channel.from'
                            defaultMessage='Removed from '
                        />
                        <span className='name'>
                            {channelName}
                        </span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        <FormattedMessage
                            id='removed_channel.remover'
                            defaultMessage='{remover} removed you from {channel}'
                            values={{
                                remover,
                                channel: (channelName),
                            }}
                        />
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.onHide}
                        id='removedChannelBtn'
                    >
                        <FormattedMessage
                            id='removed_channel.okay'
                            defaultMessage='Okay'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
