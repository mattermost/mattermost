// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {blevePurgeIndexes} from 'actions/admin_actions.jsx';

import RequestButton from 'components/admin_console/request_button/request_button';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

const label = <FormattedMessage {...messages.purgeIndexesButton_label}/>;
const helpText = <FormattedMessage {...messages.purgeIndexesHelpText}/>;
const buttonText = <FormattedMessage {...messages.purgeIndexesButton}/>;
const extraMessages = defineMessages({
    success: {
        id: 'admin.bleve.purgeIndexesButton.success',
        defaultMessage: 'Indexes purged successfully.',
    },
    error: {
        id: 'admin.bleve.purgeIndexesButton.error',
        defaultMessage: 'Failed to purge indexes: {error}',
    },
});

type Props = {
    canPurgeAndIndex: boolean;
    isDisabled?: boolean;
}

const PurgeIndexes = ({
    canPurgeAndIndex,
    isDisabled = false,
}: Props) => {
    return (
        <RequestButton
            id={FIELD_IDS.PURGE_INDEXES}
            requestAction={blevePurgeIndexes}
            helpText={helpText}
            buttonText={buttonText}
            successMessage={extraMessages.success}
            errorMessage={extraMessages.error}
            disabled={!canPurgeAndIndex || isDisabled}
            label={label}
        />
    );
};

export default PurgeIndexes;
