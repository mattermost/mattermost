// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

export default class GetAndroidApp extends React.Component {
    render() {
        return (
            <div className='get-app get-android-app'>
                <img
                    src='https://s3.amazonaws.com/uber-test/uchat/uchat_color.png'
                    className='centerMeImage'
                />
                <a
                    href={global.window.mm_config.AndroidAppDownloadLink}
                    className='btn btn-primary get-android-app__open-mattermost'
                >
                    <FormattedMessage
                        id='get_app.openMattermost'
                        defaultMessage='Download the uChat App'
                    />
                </a>
                <a
                    href='/login'
                    className='btn btn-primary get-android-app__continue-with-browser'
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
