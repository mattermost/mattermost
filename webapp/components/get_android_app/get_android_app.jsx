// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import logoImage from 'images/uchat_color.png';

export default class GetAndroidApp extends React.Component {
    render() {
        return (
            <div className='get-app get-android-app'>
                <img
                    src={logoImage}
                    className='get-app__logo'
                />
                <a
                    href={global.window.mm_config.AndroidAppDownloadLink}
                    className='btn btn-primary get-android-app__open-mattermost'
                >
                    <FormattedMessage
                        id='get_app.openMattermost'
                        defaultMessage='Use the uChat App'
                    />
                </a>
                <a
                    href='/login'
                    className='btn btn-secondary get-android-app__continue-with-browser'
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
