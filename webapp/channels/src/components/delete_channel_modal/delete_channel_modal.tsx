// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, defineMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import type {KindMessages} from 'utils/channel_kind';
import Constants from 'utils/constants';

import type {ChannelKind} from 'types/store/plugins';

export type Props = {
    onExited: () => void;
    channel: Channel;

    /** The kind of channel, so the modal says "board" rather than "channel" for a board. */
    channelKind?: ChannelKind;
    actions: {
        deleteChannel: (channelId: string) => void;
    };
};

type State = {
    show: boolean;
};

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
        const {channelKind = 'channel'} = this.props;

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
                        <FormattedMessage {...messages.title[channelKind]}/>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='alert alert-danger'>
                        <p>
                            <FormattedMessage {...messages.warning[channelKind]}/>
                        </p>
                        <p>
                            <FormattedMessage
                                {...messages.confirmArchive[channelKind]}
                                values={{
                                    display_name: this.props.channel.display_name,
                                    strong: (chunks) => <strong>{chunks}</strong>,
                                }}
                            />
                        </p>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='delete_channel.cancel'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                        autoFocus={true}
                        id='deleteChannelModalDeleteButton'
                    >
                        <FormattedMessage
                            id='delete_channel.del'
                            defaultMessage='Archive'
                        />
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const messages = {
    title: {
        channel: defineMessage({
            id: 'delete_channel.confirm',
            defaultMessage: 'Confirm ARCHIVE Channel',
        }),
        board: defineMessage({
            id: 'delete_channel.confirm.board',
            defaultMessage: 'Confirm ARCHIVE Board',
        }),
    },
    warning: {
        channel: defineMessage({
            id: 'deleteChannelModal.canViewArchivedChannelsWarning',
            defaultMessage: 'This will archive the channel from the team. Channel contents will still be accessible by channel members.',
        }),
        board: defineMessage({
            id: 'deleteChannelModal.canViewArchivedChannelsWarning.board',
            defaultMessage: 'This will archive the board from the team. Board contents will still be accessible by board members.',
        }),
    },
    confirmArchive: {
        channel: defineMessage({
            id: 'deleteChannelModal.confirmArchive',
            defaultMessage: 'Are you sure you wish to archive the <strong>{display_name}</strong> channel?',
        }),
        board: defineMessage({
            id: 'deleteChannelModal.confirmArchive.board',
            defaultMessage: 'Are you sure you wish to archive the <strong>{display_name}</strong> board?',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */
