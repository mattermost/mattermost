// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {recycleDatabaseConnection} from 'actions/admin_actions';

import RequestButton from 'components/admin_console/request_button/request_button';

import {messages} from './messages';

const helpText = (
    <FormattedMessage
        {...messages.recycleDescription}
        values={{
            featureName: (
                <b>
                    <FormattedMessage {...messages.featureName}/>
                </b>
            ),
            reloadConfiguration: (
                <a href='../environment/web_server'>
                    <b>
                        <FormattedMessage {...messages.reloadConfiguration}/>
                    </b>
                </a>
            ),
        }}
    />
);
const buttonText = <FormattedMessage {...messages.button}/>;
const errorMessage = defineMessage({
    id: 'admin.recycle.reloadFail',
    defaultMessage: 'Recycling unsuccessful: {error}',
});

type Props = {
    isDisabled?: boolean;
}

const RecycleDBButton = ({
    isDisabled,
}: Props) => {
    const isLicensed = useSelector((state: GlobalState) => getLicense(state).IsLicensed === 'true');

    if (!isLicensed) {
        return null;
    }

    return (
        <RequestButton
            requestAction={recycleDatabaseConnection}
            helpText={helpText}
            buttonText={buttonText}
            showSuccessMessage={false}
            errorMessage={errorMessage}
            includeDetailedError={true}
            disabled={isDisabled}
        />
    );
};

export default RecycleDBButton;
