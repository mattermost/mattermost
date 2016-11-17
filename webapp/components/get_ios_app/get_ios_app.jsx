// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

export default class GetIosApp extends React.Component {
    render() {
        return (
            <div className='get-app get-ios-app'>
                <img
                    src='https://s3.amazonaws.com/uber-test/uchat/uchat_color.png'
                    className='centerMeImage'
                />
                <a
                    href={`${global.window.mm_config.IosAppUrlScheme}://`}
                    className='btn btn-primary get-ios-app__open-mattermost'
                >
                    <FormattedMessage
                        id='get_app.openMattermost'
                        defaultMessage='Open in uChat App'
                    />
                </a>
                <a
                    href='/login'
                    className='btn btn-primary get-ios-app__continue-with-browser'
                >
                    <FormattedMessage
                        id='get_app.continueWithBrowserLink'
                        defaultMessage='Continue to mobile site'
                    />
                </a>
            </div>
        );
    }
}
