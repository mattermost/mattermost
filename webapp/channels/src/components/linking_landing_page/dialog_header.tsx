// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type Props = {
    downloadLink: string;
    isMobile: boolean;
    redirectPage: boolean;
}

const DialogHeader = ({downloadLink, isMobile, redirectPage}: Props) => {
    const {
        SiteName,
        EnableCustomBrand,
    } = useSelector(getConfig);

    let openingLink = (
        <FormattedMessage
            id='get_app.openingLink'
            defaultMessage='Opening link in Mattermost...'
        />
    );
    if (EnableCustomBrand === 'true') {
        openingLink = (
            <FormattedMessage
                id='get_app.openingLinkWhiteLabel'
                defaultMessage='Opening link in {appName}...'
                values={{
                    appName: SiteName || 'Mattermost',
                }}
            />
        );
    }

    if (redirectPage) {
        return (
            <h1 className='get-app__launching'>
                {openingLink}
                <div className={`get-app__alternative${redirectPage ? ' redirect-page' : ''}`}>
                    <FormattedMessage
                        id='get_app.redirectedInMoments'
                        defaultMessage='You will be redirected in a few moments.'
                    />
                    <br/>
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
                    <br className='mobile-only'/>
                    <a href={downloadLink}>
                        <FormattedMessage
                            id='get_app.downloadTheAppNow'
                            defaultMessage='Download the app now.'
                        />
                    </a>
                </div>
            </h1>
        );
    }

    let viewApp = (
        <FormattedMessage
            id='get_app.ifNothingPrompts'
            defaultMessage='You can view {siteName} in the desktop app or continue in your web browser.'
            values={{
                siteName: EnableCustomBrand === 'true' ? '' : ' Mattermost',
            }}
        />
    );
    if (isMobile) {
        viewApp = (
            <FormattedMessage
                id='get_app.ifNothingPromptsMobile'
                defaultMessage='You can view {siteName} in the mobile app or continue in your web browser.'
                values={{
                    siteName: EnableCustomBrand === 'true' ? '' : ' Mattermost',
                }}
            />
        );
    }

    return (
        <div className='get-app__launching'>
            <FormattedMessage
                id='get_app.launching'
                tagName='h1'
                defaultMessage='Where would you like to view this?'
            />
            <div className='get-app__alternative'>
                {viewApp}
            </div>
        </div>
    );
};

export default DialogHeader;
