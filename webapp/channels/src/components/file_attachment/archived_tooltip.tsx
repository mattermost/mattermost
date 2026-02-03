// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import useGetLimits from 'components/common/hooks/useGetLimits';

import {asGBString} from 'utils/limits';

export default function ArchivedTooltip() {
    const intl = useIntl();

    return (
        <>
            <div className='post-image__archived-tooltip-title'>
                {intl.formatMessage({
                    id: 'workspace_limits.archived_file.tooltip_title',
                    defaultMessage: 'Unarchive this file by upgrading',
                })}
            </div>
            <div className='post-image__archived-tooltip-description'>
                {intl.formatMessage(
                    {
                        id: 'workspace_limits.archived_file.tooltip_description',
                        defaultMessage: 'Your workspace has hit the file storage limit of {storageLimit}. To view this again, upgrade to a paid plan',
                    },
                    {
                        storageLimit: asGBString(useGetLimits()[0].files?.total_storage || 0, intl.formatNumber),
                    },
                )}
            </div>
        </>
    );
}
