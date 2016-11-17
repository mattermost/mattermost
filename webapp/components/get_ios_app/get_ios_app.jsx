// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

import AppStoreButton from 'images/app-store-button.png';
import IPhone6Mockup from 'images/iphone-6-mockup.png';

export default class GetIosApp extends React.Component {
    render() {
        return (
            <div className='get-app get-ios-app'>
                <img src='https://s3.amazonaws.com/uber-test/uchat/uchat_color.png' className='centerMeImage' />
                <a className='btn btn-primary get-ios-app__open-mattermost'       href='mattermost://' ><FormattedMessage id='get_app.openMattermost' defaultMessage='Open in uChat App' /></a>
                <a className='btn btn-primary get-ios-app__continue-with-browser' href='mattermost://' ><FormattedMessage id='get_app.continueWithBrowserLink' defaultMessage='Continue to mobile site' /></a>
            </div>
        );
    }
}
