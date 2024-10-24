// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import {rebuildChannelsIndex} from 'actions/admin_actions';

import RequestButton from 'components/admin_console/request_button/request_button';

import {messages} from './messages';

const helpText = (
    <FormattedMessage
        {...messages.rebuildChannelIndexHelpText}
        values={{
            b: (chunks: React.ReactNode) => (<b>{chunks}</b>),
        }}
    />
);
const buttonText = <FormattedMessage {...messages.rebuildChannelsIndexButtonText}/>;
const successMessage = defineMessage({
    id: 'admin.elasticsearch.rebuildIndexSuccessfully.success',
    defaultMessage: 'Channels index rebuild job triggered successfully.',
});
const errorMessage = defineMessage({
    id: 'admin.elasticsearch.rebuildIndexSuccessfully.error',
    defaultMessage: 'Failed to trigger channels index rebuild job: {error}',
});
const label = <FormattedMessage {...messages.rebuildChannelsIndexButtonText}/>;

type Props = {
    isDisabled?: boolean;
}

const RebuildChannelsIndexButton = ({
    isDisabled,
}: Props) => {
    return (
        <RequestButton
            id='rebuildChannelsIndexButton'
            requestAction={rebuildChannelsIndex}
            helpText={helpText}
            buttonText={buttonText}
            successMessage={successMessage}
            errorMessage={errorMessage}
            disabled={isDisabled}
            label={label}
        />
    );
};

export default RebuildChannelsIndexButton;
