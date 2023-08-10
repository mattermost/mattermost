// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {asGBString, inK} from 'utils/limits';

import LimitLine from './limit_line';

import type {CloudUsage, Limits} from '@mattermost/types/cloud';
import type {Message} from 'utils/i18n';

export function messageToElement(x: Message | React.ReactNode): React.ReactNode {
    if (Object.prototype.hasOwnProperty.call(x, 'defaultMessage')) {
        return (
            <FormattedMessage
                id={(x as Message).id}
                defaultMessage={(x as Message).defaultMessage}
                values={(x as Message).values}
            />
        );
    }

    return x;
}

interface Props {
    limits: Limits;
    usage: CloudUsage;
    showIcons?: boolean;
}

export default function WorkspaceLimitsPanel(props: Props) {
    const intl = useIntl();
    return (
        <div>
            <LimitLine
                icon='icon-message-text-outline'
                showIcons={props.showIcons}
                percent={props.usage.messages.history / (props.limits?.messages?.history || Number.MAX_VALUE)}
                limitName={(
                    <FormattedMessage
                        id='workspace_limits.message_history.short'
                        defaultMessage='Messages'
                    />
                )}
                limitStatus={(
                    <FormattedMessage
                        id='workspace_limits.message_history.short.usage'
                        defaultMessage='{actual} / {limit}'
                        values={{
                            actual: inK(props.usage.messages.history),
                            limit: inK(props.limits?.messages?.history || 0),
                        }}
                    />
                )}
            />
            <LimitLine
                icon='icon-folder-outline'
                showIcons={props.showIcons}
                percent={props.usage.files.totalStorage / (props.limits?.files?.total_storage || Number.MAX_VALUE)}
                limitName={(
                    <FormattedMessage
                        id='workspace_limits.file_storage.short'
                        defaultMessage='Files'
                    />
                )}
                limitStatus={(
                    <FormattedMessage
                        id='workspace_limits.file_storage.short.usage'
                        defaultMessage='{actual} / {limit}'
                        values={{
                            actual: asGBString(props.usage.files.totalStorage, intl.formatNumber),
                            limit: asGBString(props.limits?.files?.total_storage || 0, intl.formatNumber),
                        }}
                    />
                )}
            />
        </div>
    );
}
