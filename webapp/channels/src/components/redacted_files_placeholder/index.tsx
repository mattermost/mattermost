// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import LockOutlineIcon from '@mattermost/compass-icons/components/lock-outline';

import './redacted_files_placeholder.scss';

type Props = {
    count: number;
};

export default function RedactedFilesPlaceholder({count}: Props) {
    return (
        <div className='post-image__columns clearfix'>
            <div className='post-image__column post-image__column--redacted'>
                <LockOutlineIcon
                    size={24}
                    color={'rgba(var(--center-channel-color-rgb), 0.48)'}
                />
                <div className='post-image__redacted-details'>
                    <span className='post-image__redacted-message'>
                        <FormattedMessage
                            id='post.redacted_files.message'
                            defaultMessage="{count, plural, one {# file is} other {# files are}} restricted by your organization''s access policy"
                            values={{count}}
                        />
                    </span>
                </div>
            </div>
        </div>
    );
}
