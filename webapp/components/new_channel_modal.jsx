// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';

import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

const holders = defineMessages({
    nameEx: {
        id: 'channel_modal.nameEx',
        defaultMessage: 'E.g.: "Bugs", "Marketing", "客户支持"'
    }
});

import React from 'react';

class NewChannelModal extends React.Component {
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
        if (displayName.length < 1) {
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
                        defaultMessage='This field is required'
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
                    defaultMessage='Create a private group'
                />
            </a>
        );

        const isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

        if (global.window.mm_license.IsLicensed === 'true') {
            if (global.window.mm_config.RestrictPublicChannelManagement === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                createPublicChannelLink = null;
            } else if (global.window.mm_config.RestrictPublicChannelManagement === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                createPublicChannelLink = null;
            }

            if (global.window.mm_config.RestrictPrivateChannelManagement === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                createPrivateChannelLink = null;
            } else if (global.window.mm_config.RestrictPrivateChannelManagement === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                createPrivateChannelLink = null;
            }
        }

        var channelTerm = '';
        var channelSwitchText = '';
        switch (this.props.channelType) {
        case 'P':
            channelTerm = (
                <FormattedMessage
                    id='channel_modal.group'
                    defaultMessage='Group'
                />
            );
            channelSwitchText = (
                <div className='modal-intro'>
                    <FormattedMessage
                        id='channel_modal.privateGroup1'
                        defaultMessage='Create a new private group with restricted membership. '
                    />
                    {createPublicChannelLink}
                </div>
            );
            break;
        case 'O':
            channelTerm = (
                <FormattedMessage
                    id='channel_modal.channel'
                    defaultMessage='Channel'
                />
            );
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

        const prettyTeamURL = Utils.getShortenedTeamURL();

        return (
            <span>
                <Modal
                    show={this.props.show}
                    bsSize='large'
                    onHide={this.props.onModalDismissed}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <FormattedMessage
                                id='channel_modal.modalTitle'
                                defaultMessage='New '
                            />
                            {channelTerm}
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
                                        placeholder={this.props.intl.formatMessage(holders.nameEx)}
                                        maxLength='22'
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
                                        placeholder={this.props.intl.formatMessage({id: 'channel_modal.purpose'})}
                                        maxLength='128'
                                        value={this.props.channelData.purpose}
                                        onChange={this.handleChange}
                                        tabIndex='2'
                                    />
                                    <p className='input__help'>
                                        <FormattedMessage
                                            id='channel_modal.descriptionHelp'
                                            defaultMessage='Describe how this {term} should be used.'
                                            values={{
                                                term: (channelTerm)
                                            }}
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
                                        placeholder={this.props.intl.formatMessage({id: 'channel_modal.header'})}
                                        maxLength='128'
                                        value={this.props.channelData.header}
                                        onChange={this.handleChange}
                                        tabIndex='2'
                                    />
                                    <p className='input__help'>
                                        <FormattedMessage
                                            id='channel_modal.headerHelp'
                                            defaultMessage='Set text that will appear in the header of the {term} beside the {term} name. For example, include frequently used links by typing [Link Title](http://example.com).'
                                            values={{
                                                term: (channelTerm)
                                            }}
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
                                    defaultMessage='Create New '
                                />
                                {channelTerm}
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
    serverError: ''
};
NewChannelModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    channelType: React.PropTypes.string.isRequired,
    channelData: React.PropTypes.object.isRequired,
    serverError: React.PropTypes.string,
    onSubmitChannel: React.PropTypes.func.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    onTypeSwitched: React.PropTypes.func.isRequired,
    onChangeURLPressed: React.PropTypes.func.isRequired,
    onDataChanged: React.PropTypes.func.isRequired
};

export default injectIntl(NewChannelModal);
