// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertBanner from 'components/alert_banner';

import type {BotCreateWarnings} from './bot_create_warnings';
import {hasBotCreateWarnings} from './bot_create_warnings';

type Props = {
    warnings?: BotCreateWarnings;
    onDismiss: () => void;
};

const BotCreateWarningsBanner = ({warnings, onDismiss}: Props) => {
    if (!hasBotCreateWarnings(warnings)) {
        return null;
    }

    return (
        <AlertBanner
            id='botCreateWarnings'
            mode='warning'
            title={
                <FormattedMessage
                    id='bots.create_warnings.title'
                    defaultMessage='Bot account created, but some settings were not saved'
                />
            }
            message={
                <>
                    {warnings.tokenFailed && (
                        <div>
                            <FormattedMessage
                                id='bots.create_warnings.token_failed'
                                defaultMessage='An access token could not be created. Use Create New Token on this bot to create one.'
                            />
                        </div>
                    )}
                    {warnings.rolesFailed && (
                        <div>
                            <FormattedMessage
                                id='bots.create_warnings.roles_failed'
                                defaultMessage='The role and post permissions could not be saved. Edit the bot to set them again.'
                            />
                        </div>
                    )}
                    {warnings.attributesFailed && (
                        <div>
                            <FormattedMessage
                                id='bots.create_warnings.attributes_failed'
                                defaultMessage='Attributes could not be saved. Edit the bot to add them again.'
                            />
                        </div>
                    )}
                </>
            }
            onDismiss={onDismiss}
        />
    );
};

export default BotCreateWarningsBanner;
