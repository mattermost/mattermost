// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

type Props = {
    message: MessageDescriptor;
    onClick?: () => void;
}

export function Button(props: Props) {
    return (
        <button onClick={props.onClick}>
            <FormattedMessage
                id={props.message.id}
                defaultMessage={props.message.defaultMessage}
            />
        </button>
    );
}
