// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import React from 'react';
import {Link} from 'react-router/es6';

import * as Utils from 'utils/utils.jsx';

export default class ErrorPage extends React.Component {
    componentDidMount() {
        $('body').attr('class', 'sticky error');
    }
    componentWillUnmount() {
        $('body').attr('class', '');
    }
    render() {
        let title = this.props.location.query.title;
        if (!title || title === '') {
            title = Utils.localizeMessage('error.generic.title', 'Error');
        }

        let message = this.props.location.query.message;
        if (!message || message === '') {
            message = Utils.localizeMessage('error.generic.message', 'An error has occoured.');
        }

        let link = this.props.location.query.link;
        if (!link || link === '') {
            link = '/';
        }

        let linkMessage = this.props.location.query.linkmessage;
        if (!linkMessage || linkMessage === '') {
            linkMessage = Utils.localizeMessage('error.generic.link_message', 'Back to Mattermost');
        }

        return (
            <div className='container-fluid'>
                <div className='error__container'>
                    <div className='error__icon'>
                        <i className='fa fa-exclamation-triangle'/>
                    </div>
                    <h2>{title}</h2>
                    <p>{message}</p>
                    <Link to={link}>{linkMessage}</Link>
                </div>
            </div>
        );
    }
}

ErrorPage.defaultProps = {
};
ErrorPage.propTypes = {
    location: React.PropTypes.object
};
