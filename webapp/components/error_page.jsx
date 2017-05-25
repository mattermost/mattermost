// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import {ErrorPageTypes} from 'utils/constants.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
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
        if (this.props.location.query.type === ErrorPageTypes.LOCAL_STORAGE) {
            return (
                <FormattedMessage
                    id='error.local_storage.title'
                    defaultMessage='Cannot Load Mattermost'
                />
            );
        }

        if (this.props.location.query.title) {
            return this.props.location.query.title;
        }

        return Utils.localizeMessage('error.generic.title', 'Error');
    }

    renderMessage() {
        if (this.props.location.query.type === ErrorPageTypes.LOCAL_STORAGE) {
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
        }

        let message = this.props.location.query.message;
        if (!message) {
            message = Utils.localizeMessage('error.generic.message', 'An error has occoured.');
        }

        return <div dangerouslySetInnerHTML={{__html: TextFormatting.formatText(message, {linkFilter: this.linkFilter})}}/>;
    }

    renderLink() {
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
