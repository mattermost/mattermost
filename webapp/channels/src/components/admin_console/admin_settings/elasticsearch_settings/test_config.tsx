// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import RequestButton from 'components/admin_console/request_button/request_button';

import {messages} from './messages';

const helpText = <FormattedMessage {...messages.testHelpText}/>;
const buttonText = <FormattedMessage {...messages.elasticsearch_test_button}/>;
const successMessage = defineMessage({
    id: 'admin.elasticsearch.testConfigSuccess',
    defaultMessage: 'Test successful. Configuration saved.',
});

type Props = {
    doTestConfig: ComponentProps<typeof RequestButton>['requestAction'];
    isDisabled?: boolean;
}

const TestConfig = ({
    doTestConfig,
    isDisabled,
}: Props) => {
    return (
        <RequestButton
            id='testConfig'
            requestAction={doTestConfig}
            helpText={helpText}
            buttonText={buttonText}
            successMessage={successMessage}
            disabled={isDisabled}
        />
    );
};

export default TestConfig;
