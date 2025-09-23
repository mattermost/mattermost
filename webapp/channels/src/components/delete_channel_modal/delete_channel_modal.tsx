// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import Constants from 'utils/constants';

export type Props = {
    onExited: () => void;
    channel: Channel;
    actions: {
        deleteChannel: (channelId: string) => void;
    };
}

type State = {
    show: boolean;
}

export default class DeleteChannelModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {show: true};
    }

    handleDelete = () => {
        if (this.props.channel.id.length !== Constants.CHANNEL_ID_LENGTH) {
            return;
        }
        this.props.actions.deleteChannel(this.props.channel.id);
        this.onHide();
    };

    onHide = () => {
        this.setState({show: false});
    };

    render() {
        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='deleteChannelModalLabel'
                id='deleteChannelModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='deleteChannelModalLabel'
                    >
                        <FormattedMessage
                            id='delete_channel.confirm'
                            defaultMessage='Confirm ARCHIVE Channel'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='alert alert-danger'>
                        <p>
                            <FormattedMessage
                                id='deleteChannelModal.canViewArchivedChannelsWarning'
                                defaultMessage='This will archive the channel from the team. Channel contents will still be accessible by channel members.'
                            />
                        </p>
                        <p>
                            <FormattedMessage
                                id='deleteChannelModal.confirmArchive'
                                defaultMessage='Are you sure you wish to archive the <strong>{display_name}</strong> channel?'
                                values={{
                                    display_name: this.props.channel.display_name,
                                    strong: (chunks: string) => <strong>{chunks}</strong>,
                                }}
                            />
                        </p>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='delete_channel.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                        autoFocus={true}
                        id='deleteChannelModalDeleteButton'
                    >
                        <FormattedMessage
                            id='delete_channel.del'
                            defaultMessage='Archive'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
