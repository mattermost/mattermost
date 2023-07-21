// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericModal} from '@mattermost/components';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import './no_internet_connection.scss';
import NoInternetConnectionSvg from './no-internet-connection-svg';

type NoInternetConnectionProps = {
    onExited: () => void;
};
const NoInternetConnection: React.FC<NoInternetConnectionProps> = (props: NoInternetConnectionProps) => {
    return (
        <GenericModal
            onExited={props.onExited}
            modalHeaderText=''
        >
            <div className='noInternetConnection__container'>
                <div className='noInternetConnection__image'>
                    <NoInternetConnectionSvg/>
                </div>
                <span className='noInternetConnection__noAccessToInternet'>
                    <FormattedMessage
                        id='announcement_bar.warn.no_internet_connection'
                        defaultMessage='Looks like you do not have access to the internet.'
                    />
                </span>
                <span className='noInternetConnection__contactSupport'>
                    <FormattedMessage
                        id='announcement_bar.warn.contact_support_text'
                        defaultMessage='To renew your license, contact support at support@mattermost.com.'
                    />
                </span>
                <span className='noInternetConnection__emailUs'>
                    <FormattedMarkdownMessage
                        id='announcement_bar.warn.email_support'
                        defaultMessage='[Contact support](!{email}).'
                        values={{email: 'mailto:support@mattermost.com'}}
                    />
                </span>
            </div>
        </GenericModal>
    );
};

export default NoInternetConnection;
