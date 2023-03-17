// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {isCloudLicense} from 'mattermost-redux/selectors/entities/general';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {limitThresholds} from 'utils/limits';

import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import UsagePercentBar from 'components/common/usage_percent_bar';

import LHSNearingLimitsModal from 'components/cloud_usage_modal/lhs_nearing_limit_modal';

import useWords from './useWords';

import './menu_item.scss';

type Props = {
    id: string;
}

const MenuItemCloudLimit = ({id}: Props) => {
    const dispatch = useDispatch();
    const subscription = useSelector(getCloudSubscription);
    const isAdminUser = isAdmin(useSelector(getCurrentUser).roles);
    const isCloud = useSelector(isCloudLicense);
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const [limits] = useGetLimits();
    const usage = useGetUsage();
    const highestLimit = useGetHighestThresholdCloudLimit(usage, limits);
    const words = useWords(highestLimit, isAdminUser, 'menu_item_cloud_limit');

    const show = isCloud && !isFreeTrial;

    // words and highestLimit checks placed here instead of as part of show
    // because typescript doesn't correctly infer values later on otherwise
    if (!show || !words || !highestLimit) {
        return null;
    }

    let itemClass = 'MenuItemCloudLimit';
    if (((highestLimit.usage / highestLimit.limit) * 100) >= limitThresholds.danger) {
        itemClass += ' MenuItemCloudLimit--critical';
    }

    const descriptionClass = 'MenuItemCloudLimit__description';

    return (
        <li
            className={itemClass}
            role='menuitem'
            id={id}
        >
            <div className='MenuItemCloudLimit__title'>
                {words.title}
                {' '}
                <i
                    className='icon icon-information-outline'
                    onClick={() => dispatch(openModal({
                        modalId: ModalIdentifiers.CLOUD_LIMITS,
                        dialogType: LHSNearingLimitsModal,
                    }))}
                />
            </div>
            <div className={descriptionClass}>{words.description}</div>
            <div className='MenuItemCloudLimit__usage'>
                <UsagePercentBar
                    percent={Math.floor((highestLimit.usage / highestLimit.limit) * 100)}
                />
                <span className='MenuItemCloudLimit__usage-label'>{words.status}</span>
            </div>
        </li>
    );
};

export default MenuItemCloudLimit;
