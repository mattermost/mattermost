// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Channel} from '@mattermost/types/channels';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

export type Props = {
    onExited: () => void;
    channel: Channel;
    currentTeamDetails: {name: string};
    canViewArchivedChannels?: boolean;
    penultimateViewedChannelName: string;
    actions: {
        deleteChannel: (channelId: string) => {data: boolean};
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
        if (!this.props.canViewArchivedChannels) {
            const {penultimateViewedChannelName} = this.props;
            getHistory().push('/' + this.props.currentTeamDetails.name + '/channels/' + penultimateViewedChannelName);
        }
        this.props.actions.deleteChannel(this.props.channel.id);
        this.onHide();
    };

    onHide = () => {
        this.setState({show: false});
    };

    render() {
        const {canViewArchivedChannels} = this.props;
        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='dialog'
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
                        {!canViewArchivedChannels &&
                            <FormattedMarkdownMessage
                                id='delete_channel.question'
                                defaultMessage='This will archive the channel from the team and remove it from the user interface. Archived channels can be unarchived if needed again. \n \nAre you sure you wish to archive the {display_name} channel?'
                                values={{
                                    display_name: this.props.channel.display_name,
                                }}
                            />}
                        {canViewArchivedChannels &&
                            <FormattedMarkdownMessage
                                id='delete_channel.viewArchived.question'
                                defaultMessage={'This will archive the channel from the team. Channel contents will still be accessible by channel members.\n \nAre you sure you wish to archive the **{display_name}** channel?'}
                                values={{
                                    display_name: this.props.channel.display_name,
                                }}
                            />}
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
