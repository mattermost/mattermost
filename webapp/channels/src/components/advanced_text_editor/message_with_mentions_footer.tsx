// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

export default function MessageWithMentionsFooter() {
    const {formatMessage} = useIntl();

    return (
        <div className='post-body__info'>
            <span className='post-body__info__icon'>
                <InformationOutlineIcon
                    size={14}
                    color='currentColor'
                />
            </span>
            <span>
                {formatMessage({
                    id: 'edit_post.no_notification_trigger_on_mention',
                    defaultMessage: "Editing this message with an '@mention' will not notify the recipient.",
                })}
            </span>
        </div>
    );
}
