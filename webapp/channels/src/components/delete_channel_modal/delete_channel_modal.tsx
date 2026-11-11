// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, defineMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import type {Channel} from '@mattermost/types/channels';

import type {KindMessages} from 'utils/channel_kind';
import {channelKindMessages} from 'utils/channel_kind_messages';
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
                            <FormattedMessage {...channelKindMessages.archivedChannelsWarning[channelKind]}/>
                        </p>
                        <p>
                            <FormattedMessage
                                {...channelKindMessages.confirmArchive[channelKind]}
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
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                        autoFocus={true}
                        id='deleteChannelModalDeleteButton'
                        destructive={true}
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
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */
