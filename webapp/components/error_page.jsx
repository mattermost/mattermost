// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import {ErrorPageTypes} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

export default class ErrorPage extends React.Component {
    static propTypes = {
        location: PropTypes.object.isRequired
    };

    constructor(props) {
        super(props);

        this.renderTitle = this.renderTitle.bind(this);
        this.renderMessage = this.renderMessage.bind(this);
        this.renderLink = this.renderLink.bind(this);
    }

    componentDidMount() {
        $('body').attr('class', 'sticky error');
    }

    componentWillUnmount() {
        $('body').attr('class', '');
    }

    linkFilter(link) {
        return link.startsWith('https://docs.mattermost.com') || link.startsWith('https://forum.mattermost.org');
    }

    renderTitle() {
        if (this.props.location.query.title) {
            return this.props.location.query.title;
        }
        var titleID;
        if (this.props.location.query.type) {
            titleID = 'error.' + this.props.location.query.type + '.title';
        } else {
            titleID = 'error.generic.title';
        }

        return (
            <FormattedMessage
                id={titleID}
                defaultMessage='Error'
            />
        );
    }
    renderHelp() {
        switch (this.props.location.query.type) {
        case ErrorPageTypes.LOCAL_STORAGE:
            return (
                <ul>
                    <li>
                        <FormattedMessage
                            id='error.local_storage.help1'
                            defaultMessage='Enable cookies'
                        />
                    </li>
                    <li>
                        <FormattedMessage
                            id='error.local_storage.help2'
                            defaultMessage='Turn off private browsing'
                        />
                    </li>
                    <li>
                        <FormattedMessage
                            id='error.local_storage.help3'
                            defaultMessage='Use a supported browser (IE 11, Chrome 43+, Firefox 52+, Safari 9+, Edge 40+)'
                        />
                    </li>
                </ul>
            );
        case ErrorPageTypes.UNSUPPORTED_BROWSER:
            return (
                <ul>
                    <li>
                        <a
                            href='https://www.google.com/chrome/browser/desktop/index.html'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <FormattedMessage
                                id='error.unsupported_browser.help1'
                                defaultMessage='Google Chrome 43+'
                            />
                        </a>
                    </li>
                    <li>
                        <a
                            href='https://www.mozilla.org/en-US/firefox/new/'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <FormattedMessage
                                id='error.unsupported_browser.help2'
                                defaultMessage='Mozzilla Firefox 52+'
                            />
                        </a>
                    </li>
                    <li>
                        <a
                            href='https://www.microsoft.com/en-ca/download/internet-explorer.aspx'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <FormattedMessage
                                id='error.unsupported_browser.help3'
                                defaultMessage='Microsoft Internet Explorer 11+)'
                            />
                        </a>
                    </li>
                    <li>
                        <a
                            href='https://www.microsoft.com/en-ca/download/details.aspx?id=48126'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <FormattedMessage
                                id='error.unsupported_browser.help4'
                                defaultMessage='Microsoft Edge'
                            />
                        </a>
                    </li>
                    <li>
                        <a
                            href='https://support.apple.com/en-us/HT204416'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <FormattedMessage
                                id='error.unsupported_browser.help5'
                                defaultMessage='Apple Safari 9+'
                            />
                        </a>
                    </li>
                </ul>
            );
        default:
            return null;
        }
    }

    renderMessage() {
        const help = this.renderHelp();

        if (this.props.location.query.message) {
            return this.props.location.query.message;
        }

        var msgID;
        if (this.props.location.query.type) {
            msgID = 'error.' + this.props.location.query.type + '.message';
        } else {
            msgID = 'error.generic.message';
        }

        return (
            <div>
                <FormattedMessage
                    id={msgID}
                    defaultMessage='Mattermost encountered an error.'
                />
                {help}
            </div>
        );
    }

    renderLink() {
        if (this.props.location.query.type === ErrorPageTypes.UNSUPPORTED_BROWSER) {
            return null;
        }

        let link = this.props.location.query.link;
        if (link) {
            link = link.trim();
        } else {
            link = '/';
        }

        if (!link.startsWith('/')) {
            // Only allow relative links
            link = '/';
        }

        let linkMessage = this.props.location.query.linkmessage;
        if (!linkMessage) {
            linkMessage = Utils.localizeMessage('error.generic.link_message', 'Back to Mattermost');
        }

        return (
            <Link to={link}>
                {linkMessage}
            </Link>
        );
    }

    render() {
        const title = this.renderTitle();
        const message = this.renderMessage();
        const link = this.renderLink();

        return (
            <div className='container-fluid'>
                <div className='error__container'>
                    <div className='error__icon'>
                        <i className='fa fa-exclamation-triangle'/>
                    </div>
                    <h2>{title}</h2>
                    {message}
                    {link}
                </div>
            </div>
        );
    }
}
