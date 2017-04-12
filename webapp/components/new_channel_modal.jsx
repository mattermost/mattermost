// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';

import {getShortenedURL} from 'utils/url.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import * as ChannelUtils from 'utils/channel_utils.jsx';
import Constants from 'utils/constants.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import {FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

import React from 'react';

export default class NewChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.onEnterKeyDown = this.onEnterKeyDown.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        this.ctrlSend = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter');

        this.state = {
            displayNameError: ''
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.show === true && this.props.show === false) {
            this.setState({
                displayNameError: ''
            });

            document.addEventListener('keydown', this.onEnterKeyDown);
        } else if (nextProps.show === false && this.props.show === true) {
            document.removeEventListener('keydown', this.onEnterKeyDown);
        }
    }

    componentDidMount() {
        // ???
        if (UserAgent.isInternetExplorer()) {
            $('body').addClass('browser--ie');
        }

        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    onPreferenceChange() {
        this.ctrlSend = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter');
    }

    onEnterKeyDown(e) {
        if (this.ctrlSend && e.keyCode === Constants.KeyCodes.ENTER && e.ctrlKey) {
            this.handleSubmit(e);
        } else if (!this.ctrlSend && e.keyCode === Constants.KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            this.handleSubmit(e);
        }
    }

    handleSubmit(e) {
        e.preventDefault();

        const displayName = ReactDOM.findDOMNode(this.refs.display_name).value.trim();
        if (displayName.length < Constants.MIN_CHANNELNAME_LENGTH) {
            this.setState({displayNameError: true});
            return;
        }

        this.props.onSubmitChannel();
    }

    handleChange() {
        const newData = {
            displayName: this.refs.display_name.value,
            header: this.refs.channel_header.value,
            purpose: this.refs.channel_purpose.value
        };
        this.props.onDataChanged(newData);
    }

    render() {
        var displayNameError = null;
        var serverError = null;
        var displayNameClass = 'form-group';

        if (this.state.displayNameError) {
            displayNameError = (
                <p className='input__help error'>
                    <FormattedMessage
                        id='channel_modal.displayNameError'
                        defaultMessage='Channel name must be 2 or more characters'
                    />
                    {this.state.displayNameError}
                </p>
            );
            displayNameClass += ' has-error';
        }

        if (this.props.serverError) {
            serverError = <div className='form-group has-error'><p className='input__help error'>{this.props.serverError}</p></div>;
        }

        let createPublicChannelLink = (
            <a
                href='#'
                onClick={this.props.onTypeSwitched}
            >
                <FormattedMessage
                    id='channel_modal.publicChannel1'
                    defaultMessage='Create a public channel'
                />
            </a>
        );

        let createPrivateChannelLink = (
            <a
                href='#'
                onClick={this.props.onTypeSwitched}
            >
                <FormattedMessage
                    id='channel_modal.privateGroup2'
                    defaultMessage='Create a private channel'
                />
            </a>
        );

        const isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

        if (!ChannelUtils.showCreateOption(Constants.OPEN_CHANNEL, isAdmin, isSystemAdmin)) {
            createPublicChannelLink = null;
        }

        if (!ChannelUtils.showCreateOption(Constants.PRIVATE_CHANNEL, isAdmin, isSystemAdmin)) {
            createPrivateChannelLink = null;
        }

        var channelSwitchText = '';
        switch (this.props.channelType) {
        case 'P':
            channelSwitchText = (
                <div className='modal-intro'>
                    <FormattedMessage
                        id='channel_modal.privateGroup1'
                        defaultMessage='Create a new private channel with restricted membership. '
                    />
                    {createPublicChannelLink}
                </div>
            );
            break;
        case 'O':
            channelSwitchText = (
                <div className='modal-intro'>
                    <FormattedMessage
                        id='channel_modal.publicChannel2'
                        defaultMessage='Create a new public channel anyone can join. '
                    />
                    {createPrivateChannelLink}
                </div>
            );
            break;
        }

        const prettyTeamURL = getShortenedURL();

        return (
            <span>
                <Modal
                    dialogClassName='new-channel__modal'
                    show={this.props.show}
                    bsSize='large'
                    onHide={this.props.onModalDismissed}
                    onExited={this.props.onModalExited}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <FormattedMessage
                                id='channel_modal.modalTitle'
                                defaultMessage='New Channel'
                            />
                        </Modal.Title>
                    </Modal.Header>
                    <form
                        role='form'
                        className='form-horizontal'
                    >
                        <Modal.Body>
                            <div>
                                {channelSwitchText}
                            </div>
                            <div className={displayNameClass}>
                                <label className='col-sm-3 form__label control-label'>
                                    <FormattedMessage
                                        id='channel_modal.name'
                                        defaultMessage='Name'
                                    />
                                </label>
                                <div className='col-sm-9'>
                                    <input
                                        onChange={this.handleChange}
                                        type='text'
                                        ref='display_name'
                                        className='form-control'
                                        placeholder={Utils.localizeMessage('channel_modal.nameEx', 'E.g.: "Bugs", "Marketing", "客户支持"')}
                                        maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                                        value={this.props.channelData.displayName}
                                        autoFocus={true}
                                        tabIndex='1'
                                    />
                                    {displayNameError}
                                    <p className='input__help dark'>
                                        {'URL: ' + prettyTeamURL + this.props.channelData.name + ' ('}
                                        <a
                                            href='#'
                                            onClick={this.props.onChangeURLPressed}
                                        >
                                            <FormattedMessage
                                                id='channel_modal.edit'
                                                defaultMessage='Edit'
                                            />
                                        </a>
                                        {')'}
                                    </p>
                                </div>
                            </div>
                            <div className='form-group'>
                                <div className='col-sm-3'>
                                    <label className='form__label control-label'>
                                        <FormattedMessage
                                            id='channel_modal.purpose'
                                            defaultMessage='Purpose'
                                        />
                                    </label>
                                    <label className='form__label light'>
                                        <FormattedMessage
                                            id='channel_modal.optional'
                                            defaultMessage='(optional)'
                                        />
                                    </label>
                                </div>
                                <div className='col-sm-9'>
                                    <textarea
                                        className='form-control no-resize'
                                        ref='channel_purpose'
                                        rows='4'
                                        placeholder={Utils.localizeMessage('channel_modal.purposeEx', 'E.g.: "A channel to file bugs and improvements"')}
                                        maxLength='250'
                                        value={this.props.channelData.purpose}
                                        onChange={this.handleChange}
                                        tabIndex='2'
                                    />
                                    <p className='input__help'>
                                        <FormattedMessage
                                            id='channel_modal.descriptionHelp'
                                            defaultMessage='Describe how this channel should be used.'
                                        />
                                    </p>
                                </div>
                            </div>
                            <div className='form-group less'>
                                <div className='col-sm-3'>
                                    <label className='form__label control-label'>
                                        <FormattedMessage
                                            id='channel_modal.header'
                                            defaultMessage='Header'
                                        />
                                    </label>
                                    <label className='form__label light'>
                                        <FormattedMessage
                                            id='channel_modal.optional'
                                            defaultMessage='(optional)'
                                        />
                                    </label>
                                </div>
                                <div className='col-sm-9'>
                                    <textarea
                                        className='form-control no-resize'
                                        ref='channel_header'
                                        rows='4'
                                        placeholder={Utils.localizeMessage('channel_modal.headerEx', 'E.g.: "[Link Title](http://example.com)"')}
                                        maxLength='1024'
                                        value={this.props.channelData.header}
                                        onChange={this.handleChange}
                                        tabIndex='2'
                                    />
                                    <p className='input__help'>
                                        <FormattedMessage
                                            id='channel_modal.headerHelp'
                                            defaultMessage='Set text that will appear in the header of the channel beside the channel name. For example, include frequently used links by typing [Link Title](http://example.com).'
                                        />
                                    </p>
                                    {serverError}
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <button
                                type='button'
                                className='btn btn-default'
                                onClick={this.props.onModalDismissed}
                            >
                                <FormattedMessage
                                    id='channel_modal.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                            <button
                                onClick={this.handleSubmit}
                                type='submit'
                                className='btn btn-primary'
                                tabIndex='3'
                            >
                                <FormattedMessage
                                    id='channel_modal.createNew'
                                    defaultMessage='Create New Channel'
                                />
                            </button>
                        </Modal.Footer>
                    </form>
                </Modal>
            </span>
        );
    }
}

NewChannelModal.defaultProps = {
    show: false,
    channelType: 'O',
    serverError: null
};
NewChannelModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    channelType: React.PropTypes.string.isRequired,
    channelData: React.PropTypes.object.isRequired,
    serverError: React.PropTypes.node,
    onSubmitChannel: React.PropTypes.func.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    onModalExited: React.PropTypes.func,
    onTypeSwitched: React.PropTypes.func.isRequired,
    onChangeURLPressed: React.PropTypes.func.isRequired,
    onDataChanged: React.PropTypes.func.isRequired
};

