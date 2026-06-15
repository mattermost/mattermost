// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import './redacted_files_placeholder.scss';

type Props = {
    count?: number;
    compactDisplay?: boolean;
};

function RedactedFilesPlaceholder({compactDisplay}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'post.redacted_files.title',
        defaultMessage: 'Files not available',
    });
    const subtitle = formatMessage({
        id: 'post.redacted_files.subtitle',
        defaultMessage: 'Access to files is restricted based on attributes',
    });

    if (compactDisplay) {
        return (
            <div
                className='post-image__column post-image__column--redacted post-image__column--redacted-compact'
                data-testid='redactedFilesPlaceholder'
                title={`${title} — ${subtitle}`}
            >
                <div className='post-image__redacted-icon'>
                    <svg
                        width='16'
                        height='20'
                        viewBox='0 0 32 40'
                        fill='none'
                        xmlns='http://www.w3.org/2000/svg'
                    >
                        <path
                            d='M28 0H11.898C11.104 0 10.356 0.308 9.79 0.864L0.892 9.644C0.326 10.206 0 10.984 0 11.78V36C0 38.206 1.794 40 4 40H28C30.206 40 32 38.206 32 36V4C32 1.794 30.206 0 28 0ZM10 3.468V11H2.368L10 3.468ZM30 36C30 37.102 29.102 38 28 38H4C2.896 38 2 37.102 2 36V13H10C11.104 13 12 12.104 12 11V2H28C29.102 2 30 2.896 30 4V36Z'
                            fill='rgba(var(--center-channel-color-rgb), 0.64)'
                        />
                    </svg>
                </div>
                <span className='post-image__redacted-title'>{title}</span>
            </div>
        );
    }

    return (
        <div className='post-image__columns clearfix'>
            <div
                className='post-image__column post-image__column--redacted'
                data-testid='redactedFilesPlaceholder'
            >
                <div className='post-image__redacted-icon'>
                    <svg
                        width='32'
                        height='40'
                        viewBox='0 0 32 40'
                        fill='none'
                        xmlns='http://www.w3.org/2000/svg'
                    >
                        <path
                            d='M28 0H11.898C11.104 0 10.356 0.308 9.79 0.864L0.892 9.644C0.326 10.206 0 10.984 0 11.78V36C0 38.206 1.794 40 4 40H28C30.206 40 32 38.206 32 36V4C32 1.794 30.206 0 28 0ZM10 3.468V11H2.368L10 3.468ZM30 36C30 37.102 29.102 38 28 38H4C2.896 38 2 37.102 2 36V13H10C11.104 13 12 12.104 12 11V2H28C29.102 2 30 2.896 30 4V36Z'
                            fill='rgba(var(--center-channel-color-rgb), 0.64)'
                        />
                    </svg>
                </div>
                <div className='post-image__redacted-details'>
                    <span className='post-image__redacted-title'>{title}</span>
                    <span className='post-image__redacted-subtitle'>{subtitle}</span>
                </div>
            </div>
        </div>
    );
}

export default memo(RedactedFilesPlaceholder);
