// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {EyeOffOutlineIcon} from '@mattermost/compass-icons/components';

import useGetServerLimits from 'components/common/hooks/useGetServerLimits';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import './index.scss';

export default function CenterMessageLock() {
    const intl = useIntl();

    const {openPricingModal} = useOpenPricingModal();

    const [limitsLoaded] = useGetServerLimits();

    if (!limitsLoaded) {
        return null;
    }

    const title = intl.formatMessage({
        id: 'workspace_limits.message_history.locked.title.admin',
        defaultMessage: 'Limited history is displayed',
    });

    const description = intl.formatMessage(
        {
            id: 'workspace_limits.message_history.locked.description.admin',
            defaultMessage: 'Full access to message history is included in <a>paid plans</a>',
        },
        {
            a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                <a
                    href='#'
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        openPricingModal();
                    }}
                >
                    {chunks}
                </a>
            ),
        },
    );

    return (<div className='CenterMessageLock'>
        <div className='CenterMessageLock__left'>
            <EyeOffOutlineIcon
                size={16}
                color={'rgba(var(--center-channel-color-rgb), 0.75)'}
            />
        </div>
        <div className='CenterMessageLock__right'>
            <div className='CenterMessageLock__title'>
                {title}
            </div>
            <div className='CenterMessageLock__description'>
                {description}
            </div>
        </div>
    </div>);
}
