// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

type Props = {
    downloadLink: string;
    redirectPage: boolean;
    location: string;
    isMobile: boolean;
}

const DownloadLink = ({downloadLink, redirectPage, location, isMobile}: Props) => {
    if (redirectPage) {
        return (
            <div className='get-app__download-link'>
                <FormattedMarkdownMessage
                    id='get_app.openLinkInBrowser'
                    defaultMessage='Or, [open this link in your browser.](!{link})'
                    values={{
                        link: location,
                    }}
                />
            </div>
        );
    } else if (downloadLink) {
        return (
            <div className='get-app__download-link'>
                {isMobile ? (
                    <FormattedMessage
                        id='get_app.dontHaveTheMobileApp'
                        defaultMessage={'Don\'t have the Mobile App?'}
                    />
                ) : (
                    <FormattedMessage
                        id='get_app.dontHaveTheDesktopApp'
                        defaultMessage={'Don\'t have the Desktop App?'}
                    />
                )}
                {'\u00A0'}
                <br/>
                <a href={downloadLink}>
                    <FormattedMessage
                        id='get_app.downloadTheAppNow'
                        defaultMessage='Download the app now.'
                    />
                </a>
            </div>
        );
    }

    return null;
};

export default DownloadLink;
