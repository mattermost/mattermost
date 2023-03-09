// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ErrorPageTypes} from 'utils/constants';
import * as Utils from 'utils/utils';

type Props = {
    type?: string | null;
    title: string;
}

const ErrorTitle: React.FC<Props> = ({type, title}: Props) => {
    let errorTitle = null;
    if (type) {
        switch (type) {
        case ErrorPageTypes.LOCAL_STORAGE:
            errorTitle = (
                <FormattedMessage
                    id='error.local_storage.title'
                    defaultMessage='Cannot Load Mattermost'
                />
            );
            break;
        case ErrorPageTypes.PERMALINK_NOT_FOUND:
            errorTitle = (
                <FormattedMessage
                    id='permalink.error.title'
                    defaultMessage='Message Not Found'
                />
            );
            break;
        case ErrorPageTypes.CLOUD_ARCHIVED:
            errorTitle = (
                <FormattedMessage
                    id='cloud_archived.error.title'
                    defaultMessage='Message Archived'
                />
            );
            break;
        case ErrorPageTypes.OAUTH_ACCESS_DENIED:
            errorTitle = (
                <FormattedMessage
                    id='error.oauth_access_denied.title'
                    defaultMessage='Authorization Error'
                />
            );
            break;
        case ErrorPageTypes.OAUTH_MISSING_CODE:
            errorTitle = (
                <FormattedMessage
                    id='error.oauth_missing_code.title'
                    defaultMessage='Mattermost Needs Your Help'
                />
            );
            break;
        case ErrorPageTypes.OAUTH_INVALID_REDIRECT_URL:
        case ErrorPageTypes.OAUTH_INVALID_PARAM:
            errorTitle = (
                <FormattedMessage
                    id='error.oauth_invalid_param.title'
                    defaultMessage='OAuth Parameter Error'
                />
            );
            break;
        case ErrorPageTypes.TEAM_NOT_FOUND:
            errorTitle = (
                <FormattedMessage
                    id='error.team_not_found.title'
                    defaultMessage='Team Not Found'
                />
            );
            break;
        case ErrorPageTypes.CHANNEL_NOT_FOUND:
            errorTitle = (
                <FormattedMessage
                    id='error.channel_not_found.title'
                    defaultMessage='Channel Not Found'
                />
            );
            break;
        case ErrorPageTypes.PAGE_NOT_FOUND:
        default:
            errorTitle = (
                <FormattedMessage
                    id='error.not_found.title'
                    defaultMessage='Page Not Found'
                />
            );
        }
    } else if (title) {
        errorTitle = <>{title}</>;
    } else {
        errorTitle = <>{Utils.localizeMessage('error.generic.title', 'Error')}</>;
    }

    return errorTitle;
};

export default ErrorTitle;
