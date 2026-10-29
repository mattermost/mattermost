// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, defineMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {General} from 'mattermost-redux/constants';

import type {KindMessages} from 'utils/channel_kind';
import Constants from 'utils/constants';

import type {ChannelKind} from 'types/store/plugins';

type Props = {
    channelDisplayName: string;
    channelId: string;

    /**
     * The kind of channel, so the modal says "board" rather than "channel" for a board
     */
    channelKind?: ChannelKind;

    /**
     * Function injected by ModalController to be called when the modal can be unmounted
     */
    onExited: () => void;

    actions: {
        updateChannelPrivacy: (channelId: string, privacy: string) => void;
    };
};

type State = {
    show: boolean;
};

export default class ConvertChannelModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {show: true};
    }

    handleConvert = () => {
        const {actions, channelId} = this.props;
        if (channelId.length !== Constants.CHANNEL_ID_LENGTH) {
            return;
        }

        actions.updateChannelPrivacy(channelId, General.PRIVATE_CHANNEL);
        this.onHide();
    };

    onHide = () => {
        this.setState({show: false});
    };

    render() {
        const {
            channelDisplayName,
            channelKind = 'channel',
            onExited,
        } = this.props;

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={onExited}
                role='none'
                aria-labelledby='convertChannelModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='convertChannelModalLabel'
                    >
                        <FormattedMessage
                            {...messages.title[channelKind]}
                            values={{
                                display_name: channelDisplayName,
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        <FormattedMessage
                            {...messages.question1[channelKind]}
                            values={{
                                display_name: channelDisplayName,
                                b: (chunks) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            {...messages.question3[channelKind]}
                            values={{
                                display_name: channelDisplayName,
                                b: (chunks) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={this.onHide}
                        data-testid='convertChannelCancel'
                    >
                        <FormattedMessage
                            id='convert_channel.cancel'
                            defaultMessage='No, cancel'
                        />
                    </Button>
                    <Button
                        type='button'
                        emphasis='primary'
                        data-dismiss='modal'
                        onClick={this.handleConvert}
                        autoFocus={true}
                        data-testid='convertChannelConfirm'
                    >
                        <FormattedMessage {...messages.confirm[channelKind]}/>
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
            id: 'convert_channel.title',
            defaultMessage: 'Convert {display_name} to a Private Channel?',
        }),
        board: defineMessage({
            id: 'convert_channel.title.board',
            defaultMessage: 'Convert {display_name} to a Private Board?',
        }),
    },
    question1: {
        channel: defineMessage({
            id: 'convertChannel.question1',
            defaultMessage: 'When you convert <b>{display_name}</b> to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.',
        }),
        board: defineMessage({
            id: 'convertChannel.question1.board',
            defaultMessage: 'When you convert <b>{display_name}</b> to a private board, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private board is by invitation only.',
        }),
    },
    question3: {
        channel: defineMessage({
            id: 'convertChannel.question3',
            defaultMessage: 'Are you sure you want to convert <b>{display_name}</b> to a private channel?',
        }),
        board: defineMessage({
            id: 'convertChannel.question3.board',
            defaultMessage: 'Are you sure you want to convert <b>{display_name}</b> to a private board?',
        }),
    },
    confirm: {
        channel: defineMessage({
            id: 'convert_channel.confirm',
            defaultMessage: 'Yes, convert to private channel',
        }),
        board: defineMessage({
            id: 'convert_channel.confirm.board',
            defaultMessage: 'Yes, convert to private board',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */
