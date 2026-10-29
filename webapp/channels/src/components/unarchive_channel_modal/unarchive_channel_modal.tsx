// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, defineMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {KindMessages} from 'utils/channel_kind';
import Constants from 'utils/constants';

import type {ChannelKind} from 'types/store/plugins';

type Props = {
    onExited: () => void;
    channel: Channel;

    /** The kind of channel, so the modal says "board" rather than "channel" for a board. */
    channelKind?: ChannelKind;
    actions: ChannelDetailsActions;
};

type State = {
    show: boolean;
};

export type ChannelDetailsActions = {
    unarchiveChannel: (channelId: string) => Promise<ActionResult>;
};

export default class UnarchiveChannelModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {show: true};
    }

    handleUnarchive = (): void => {
        if (this.props.channel.id.length !== Constants.CHANNEL_ID_LENGTH) {
            return;
        }
        this.props.actions.unarchiveChannel(this.props.channel.id);
        this.onHide();
    };

    onHide = (): void => {
        this.setState({show: false});
    };

    render(): JSX.Element {
        const {channelKind = 'channel'} = this.props;

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='unarchiveChannelModalLabel'
                id='unarchiveChannelModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='unarchiveChannelModalLabel'
                    >
                        <FormattedMessage {...messages.title[channelKind]}/>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='alert alert-danger'>
                        <FormattedMessage
                            {...messages.question[channelKind]}
                            values={{
                                display_name: this.props.channel.display_name,
                                b: (chunks) => <b>{chunks}</b>,
                            }}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='unarchive_channel.cancel'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        data-dismiss='modal'
                        onClick={this.handleUnarchive}
                        autoFocus={true}
                        id='unarchiveChannelModalDeleteButton'
                    >
                        <FormattedMessage
                            id='unarchive_channel.del'
                            defaultMessage='Unarchive'
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
            id: 'unarchive_channel.confirm',
            defaultMessage: 'Confirm UNARCHIVE Channel',
        }),
        board: defineMessage({
            id: 'unarchive_channel.confirm.board',
            defaultMessage: 'Confirm UNARCHIVE Board',
        }),
    },
    question: {
        channel: defineMessage({
            id: 'unarchiveChannelModal.viewArchived.question',
            defaultMessage: 'Are you sure you wish to unarchive the <b>{display_name}</b> channel?',
        }),
        board: defineMessage({
            id: 'unarchiveChannelModal.viewArchived.question.board',
            defaultMessage: 'Are you sure you wish to unarchive the <b>{display_name}</b> board?',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */
