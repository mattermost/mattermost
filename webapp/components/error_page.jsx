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

    componentDidMount() {
        $('body').attr('class', 'sticky error');
    }

    componentWillUnmount() {
        $('body').attr('class', '');
    }

    renderTitle = () => {
        switch (this.props.location.query.type) {
        case ErrorPageTypes.LOCAL_STORAGE:
            return (
                <FormattedMessage
                    id='error.local_storage.title'
                    defaultMessage='Cannot Load Mattermost'
                />
            );
        case ErrorPageTypes.PERMALINK_NOT_FOUND:
            return (
                <FormattedMessage
                    id='permalink.error.title'
                    defaultMessage='Message Not Found'
                />
            );
        case ErrorPageTypes.PAGE_NOT_FOUND:
            return (
                <FormattedMessage
                    id='error.not_found.title'
                    defaultMessage='Message Not Found'
                />
            );
        }

        if (this.props.location.query.title) {
            return this.props.location.query.title;
        }

        return Utils.localizeMessage('error.generic.title', 'Error');
    }

    renderMessage = () => {
        switch (this.props.location.query.type) {
        case ErrorPageTypes.LOCAL_STORAGE:
            return (
                <div>
                    <FormattedMessage
                        id='error.local_storage.message'
                        defaultMessage='Mattermost was unable to load because a setting in your browser prevents the use of its local storage features. To allow Mattermost to load, try the following actions:'
                    />
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
                                defaultMessage='Use a supported browser (IE 11, Chrome 43+, Firefox 38+, Safari 9, Edge)'
                            />
                        </li>
                    </ul>
                </div>
            );
        case ErrorPageTypes.PERMALINK_NOT_FOUND:
            return (
                <p>
                    <FormattedMessage
                        id='permalink.error.access'
                        defaultMessage='Permalink belongs to a deleted message or to a channel to which you do not have access.'
                    />
                </p>
            );
        case ErrorPageTypes.OAUTH_MISSING_CODE:
            return (
                <div>
                    <p>
                        <FormattedMessage
                            id='error.oauth_missing_code'
                            defaultMessage='The service provider {service} did not provide an authorization code in the redirect URL.'
                            values={{
                                service: this.props.location.query.service
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='error.oauth_missing_code.google'
                            defaultMessage='For {link} make sure your administrator enabled the Google+ API.'
                            values={{
                                link: this.renderLink('https://docs.mattermost.com/deployment/sso-google.html', 'error.oauth_missing_code.google.link', 'Google Apps')
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='error.oauth_missing_code.office365'
                            defaultMessage='For {link} make sure the administrator of your Microsoft organization has enabled the Mattermost app.'
                            values={{
                                link: this.renderLink('https://docs.mattermost.com/deployment/sso-office.html', 'error.oauth_missing_code.office365.link', 'Office 365')
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='error.oauth_missing_code.gitlab'
                            defaultMessage='For {link} please make sure you followed the setup instructions.'
                            values={{
                                link: this.renderLink('https://docs.mattermost.com/deployment/sso-gitlab.html', 'error.oauth_missing_code.gitlab.link', 'GitLab')
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='error.oauth_missing_code.forum'
                            defaultMessage="If you reviewed the above and are still having trouble with configuration, you may post in our {link} where we'll be happy to help with issues during setup."
                            values={{
                                link: this.renderLink('https://forum.mattermost.org/c/trouble-shoot', 'error.oauth_missing_code.forum.link', 'Troubleshooting forum')
                            }}
                        />
                    </p>
                </div>
            );
        case ErrorPageTypes.PAGE_NOT_FOUND:
            return (
                <p>
                    <FormattedMessage
                        id='error.not_found.message'
                        defaultMessage='The page you were trying to reach does not exist'
                    />
                </p>
            );
        }

        if (this.props.location.query.message) {
            return <p>{this.props.location.query.message}</p>;
        }

        return (
            <p>
                <FormattedMessage
                    id='error.generic.message'
                    defaultMessage='An error has occurred.'
                />
            </p>
        );
    }

    renderLink = (url, id, defaultMessage) => {
        return (
            <a
                href={url}
                rel='noopener noreferrer'
                target='_blank'
            >
                <FormattedMessage
                    id={id}
                    defaultMessage={defaultMessage}
                />
            </a>
        );
    }

    render() {
        const title = this.renderTitle();
        const message = this.renderMessage();

        return (
            <div className='container-fluid'>
                <div className='error__container'>
                    <div className='error__icon'>
                        <i className='fa fa-exclamation-triangle'/>
                    </div>
                    <h2>
                        {title}
                    </h2>
                    {message}
                    <Link to='/'>
                        <FormattedMessage
                            id='error.generic.link'
                            defaultMessage='Back to Mattermost'
                        />
                    </Link>
                </div>
            </div>
        );
    }
}
