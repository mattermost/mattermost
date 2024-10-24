// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import {elasticsearchPurgeIndexes} from 'actions/admin_actions';

import RequestButton from 'components/admin_console/request_button/request_button';

import {messages} from './messages';

const helpText = <FormattedMessage {...messages.purgeIndexesHelpText}/>;
const buttonText = <FormattedMessage {...messages.purgeIndexesButton}/>;
const successMessage = defineMessage({
    id: 'admin.elasticsearch.purgeIndexesButton.success',
    defaultMessage: 'Indexes purged successfully.',
});
const errorMessage = defineMessage({
    id: 'admin.elasticsearch.purgeIndexesButton.error',
    defaultMessage: 'Failed to purge indexes: {error}',
});
const label = <FormattedMessage {...messages.label}/>;

type Props = {
    isDisabled?: boolean;
}

const PurgeIndexesSection = ({
    isDisabled,
}: Props) => {
    return (
        <RequestButton
            id='purgeIndexesSection'
            requestAction={elasticsearchPurgeIndexes}
            helpText={helpText}
            buttonText={buttonText}
            successMessage={successMessage}
            errorMessage={errorMessage}
            disabled={isDisabled}
            label={label}
        />
    );
};

export default PurgeIndexesSection;
