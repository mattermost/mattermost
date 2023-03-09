// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, MouseEvent} from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage, injectIntl, IntlShape} from 'react-intl';

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {ServerError} from '@mattermost/types/errors';

import LocalizedInput from 'components/localized_input/localized_input';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import {getShortenedURL, validateChannelUrl} from 'utils/url';
import * as Utils from 'utils/utils';

const holders = defineMessages({
    maxLength: {
        id: t('rename_channel.maxLength'),
        defaultMessage: 'This field must be less than {maxLength, number} characters',
    },
    url: {
        id: t('rename_channel.url'),
        defaultMessage: 'URL',
    },
    defaultError: {
        id: t('rename_channel.defaultError'),
        defaultMessage: ' - Cannot be changed for the default channel',
    },
    displayNameHolder: {
        id: t('rename_channel.displayNameHolder'),
        defaultMessage: 'Enter display name',
    },
});

type Props = {

    /**
     * react-intl helper object
     */
    intl: IntlShape;

    /**
     * Function that is called when modal is hidden
     */
    onExited: () => void;

    /**
     * Object with info about current channel
     */
    channel: Channel;

    /**
     * Object with info about current team
     */
    team: Team;

    /**
     * String with the current team URL
     */
    currentTeamUrl: string;

    /*
    * Object with redux action creators
    */
    actions: {

        /*
        * Action creator to patch current channel
        */
        patchChannel: (channelId: string, patch: Channel) => Promise<{ data: Channel; error: Error }>;
    };
}

type State = {
    displayName: string;
    channelName: string;
    serverError?: string;
    urlErrors: React.ReactNode[];
    displayNameError: React.ReactNode;
    invalid: boolean;
    show: boolean;
};

export class RenameChannelModal extends React.PureComponent<Props, State> {
    private textbox?: HTMLInputElement;

    constructor(props: Props) {
        super(props);

        this.state = {
            displayName: props.channel.display_name,
            channelName: props.channel.name,
            serverError: '',
            urlErrors: [],
            displayNameError: '',
            invalid: false,
            show: true,
        };
    }

    setError = (err: ServerError) => {
        this.setState({serverError: err.message});
    }

    unsetError = () => {
        this.setState({serverError: ''});
    }

    handleEntering = () => {
        if (this.textbox) {
            Utils.placeCaretAtEnd(this.textbox);
        }
    }

    handleHide = (e?: MouseEvent) => {
        if (e) {
            e.preventDefault();
        }

        this.setState({
            serverError: '',
            urlErrors: [],
            displayNameError: '',
            invalid: false,
            show: false,
        });
    }

    handleSubmit = async (e?: MouseEvent<HTMLButtonElement>): Promise<void> => {
        if (e) {
            e.preventDefault();
        }

        const channel = Object.assign({}, this.props.channel);
        const oldName = channel.name;
        const oldDisplayName = channel.display_name;
        const state = {...this.state, serverError: ''};
        const {formatMessage} = this.props.intl;
        const {actions: {patchChannel}} = this.props;

        channel.display_name = this.state.displayName.trim();
        if (!channel.display_name || channel.display_name.length < Constants.MIN_CHANNELNAME_LENGTH) {
            state.displayNameError = (
                <FormattedMessage
                    id='rename_channel.minLength'
                    defaultMessage='Display name must have at least {minLength, number} characters.'
                    values={{
                        minLength: Constants.MIN_CHANNELNAME_LENGTH,
                    }}
                />
            );
            state.invalid = true;
        } else if (channel.display_name.length > Constants.MAX_CHANNELNAME_LENGTH) {
            state.displayNameError = formatMessage(holders.maxLength, {maxLength: Constants.MAX_CHANNELNAME_LENGTH});
            state.invalid = true;
        } else {
            state.displayNameError = '';
        }

        channel.name = this.state.channelName.trim();
        const urlErrors = validateChannelUrl(channel.name);
        if (urlErrors.length > 0) {
            state.invalid = true;
        }
        state.urlErrors = urlErrors;

        this.setState(state);

        if (state.invalid) {
            return;
        }
        if (oldName === channel.name && oldDisplayName === channel.display_name) {
            this.onSaveSuccess();
            return;
        }

        const {data, error} = await patchChannel(channel.id, channel);

        if (data) {
            this.onSaveSuccess();
        } else if (error) {
            this.setError(error);
        }
    }

    onSaveSuccess = () => {
        this.handleHide();
        this.unsetError();
        getHistory().push('/' + this.props.team.name + '/channels/' + this.state.channelName);
    }

    handleCancel = (e?: MouseEvent) => {
        this.setState({
            displayName: this.props.channel.display_name,
            channelName: this.props.channel.name,
        });

        this.handleHide(e);
    }

    onNameChange = (e: ChangeEvent<HTMLInputElement> | {target: {value: string}}) => {
        const name = e.target.value.trim().replace(/[^A-Za-z0-9-_]/g, '').toLowerCase();
        this.setState({channelName: name});
    }

    onDisplayNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({displayName: e.target.value});
    }

    getTextbox = (node: HTMLInputElement) => {
        this.textbox = node;
    }

    render(): JSX.Element {
        let displayNameError = null;
        if (this.state.displayNameError) {
            displayNameError = <p className='input__help error'>{this.state.displayNameError}</p>;
        }

        let urlErrors = null;
        let urlHelpText = null;
        let urlInputClass = 'input-group input-group--limit';
        if (this.state.urlErrors.length > 0) {
            urlErrors = <p className='input__help error'>{this.state.urlErrors}</p>;
            urlInputClass += ' has-error';
        } else {
            urlHelpText = (
                <p className='input__help'>
                    <FormattedMessage
                        id='change_url.helpText'
                        defaultMessage='You can use lowercase letters, numbers, dashes, and underscores.'
                    />
                </p>
            );
        }

        let serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        const {formatMessage} = this.props.intl;

        let urlInputLabel = formatMessage(holders.url);
        let readOnlyHandleInput = false;
        if (this.props.channel.name === Constants.DEFAULT_CHANNEL) {
            urlInputLabel += formatMessage(holders.defaultError);
            readOnlyHandleInput = true;
        }

        const fullUrl = this.props.currentTeamUrl + '/channels';
        const shortUrl = `${getShortenedURL(fullUrl, 35)}/`;
        const urlTooltip = (
            <Tooltip id='urlTooltip'>{fullUrl}</Tooltip>
        );

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.state.show}
                onHide={this.handleCancel}
                onEntering={this.handleEntering}
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
                <form role='form'>
                    <Modal.Body>
                        <div className='form-group'>
                            <label className='control-label'>
                                <FormattedMessage
                                    id='rename_channel.displayName'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <LocalizedInput
                                onChange={this.onDisplayNameChange}
                                type='text'
                                ref={this.getTextbox}
                                id='display_name'
                                className='form-control'
                                placeholder={holders.displayNameHolder}
                                value={this.state.displayName}
                                maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                                aria-label={formatMessage({id: 'rename_channel.displayName', defaultMessage: 'Display Name'}).toLowerCase()}
                            />
                            {displayNameError}
                        </div>
                        <div className='form-group'>
                            <label className='control-label'>{urlInputLabel}</label>

                            <div className={urlInputClass}>
                                <OverlayTrigger
                                    delayShow={Constants.OVERLAY_TIME_DELAY}
                                    placement='top'
                                    overlay={urlTooltip}
                                >
                                    <span className='input-group-addon'>{shortUrl}</span>
                                </OverlayTrigger>
                                <input
                                    onChange={this.onNameChange}
                                    type='text'
                                    className='form-control'
                                    id='channel_name'
                                    value={this.state.channelName}
                                    maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                                    readOnly={readOnlyHandleInput}
                                    aria-label={formatMessage({id: 'rename_channel.title', defaultMessage: 'Rename Channel'}).toLowerCase()}
                                />
                            </div>
                            {urlHelpText}
                            {urlErrors}
                        </div>
                        {serverError}
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-link'
                            onClick={this.handleCancel}
                        >
                            <FormattedMessage
                                id='rename_channel.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            onClick={this.handleSubmit}
                            type='submit'
                            id='save-button'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='rename_channel.save'
                                defaultMessage='Save'
                            />
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

export default injectIntl(RenameChannelModal);
