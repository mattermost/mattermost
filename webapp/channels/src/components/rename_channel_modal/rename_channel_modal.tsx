// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
}

type Props = {
    channel: Channel;
    teamName: string;
    onExited: () => void;
    actions: Actions;
    intl: IntlShape;
}

type State = {
    show: boolean;
    displayName: string;
    channelUrl: string;
    isSaving: boolean;
    urlError: string;
}

export class RenameChannelModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            show: true,
            displayName: props.channel.display_name,
            channelUrl: props.channel.name,
            isSaving: false,
            urlError: '',
        };
    }

    onHide = () => {
        this.setState({show: false});
    };

    handleSave = async () => {
        const {channel, actions: {patchChannel}} = this.props;
        const {displayName, channelUrl} = this.state;

        if (!channel || !displayName?.trim()) {
            return;
        }

        // Validate min/max on display name
        const trimmedDisplayName = displayName.trim();
        if (trimmedDisplayName.length < Constants.MIN_CHANNELNAME_LENGTH ||
            trimmedDisplayName.length > Constants.MAX_CHANNELNAME_LENGTH) {
            return;
        }

        this.setState({isSaving: true});
        const {data, error} = await patchChannel(channel.id, {
            display_name: trimmedDisplayName,
            name: channelUrl.trim(),
        });
        this.setState({isSaving: false});

        if (data && !error) {
            this.onHide();

            // Use the actual channel name from the response, as the server may have sanitized it
            const updatedChannelName = data.name || channelUrl.trim();
            const path = `/${this.props.teamName}/channels/${updatedChannelName}`;
            getHistory().push(path);
        }
    };

    render() {
        const {formatMessage} = this.props.intl;
        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='renameChannelModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='renameChannelModalLabel'
                    >
                        <FormattedMessage
                            id='rename_channel.title'
                            defaultMessage='Rename Channel'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ChannelNameFormField
                        value={this.state.displayName}
                        name='rename-channel'
                        placeholder={formatMessage({
                            id: 'rename_channel.displayNameHolder',
                            defaultMessage: 'Enter display name',
                        })}
                        onDisplayNameChange={(name) => this.setState({displayName: name})}
                        onURLChange={(url) => this.setState({channelUrl: url})}
                        currentUrl={this.state.channelUrl}
                        readOnly={false}
                        isEditingExistingChannel={true}
                        onErrorStateChange={(isError, errorMsg) => this.setState({urlError: isError ? (errorMsg || '') : ''})}
                        urlError={this.state.urlError}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-tertiary cancel-button'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='generic_btn.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        disabled={this.state.isSaving}
                        onClick={this.handleSave}
                    >
                        <FormattedMessage
                            id='generic_btn.save'
                            defaultMessage='Save'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default injectIntl(RenameChannelModal);

