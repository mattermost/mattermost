// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import LHSNearingLimitsModal from 'components/cloud_usage_modal/lhs_nearing_limit_modal';
import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useWords from 'components/common/hooks/useWords';
import UsagePercentBar from 'components/common/usage_percent_bar';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {limitThresholds} from 'utils/limits';

interface Props {
    isUserAdmin: boolean;
    isCloudLicensed: boolean;
    isFreeTrialSubscription: boolean;
}

export default function ProductSwitcherCloudLimitsFooter(props: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();

    const [limits] = useGetLimits();
    const usage = useGetUsage();
    const highestLimit = useGetHighestThresholdCloudLimit(usage, limits);

    const words = useWords(highestLimit, props.isUserAdmin);

    // Show only for cloud and not during free trial
    if (props.isCloudLicensed && !props.isFreeTrialSubscription) {
        return null;
    }

    if (!words || !highestLimit) {
        return null;
    }

    const usagePercent = Math.floor((highestLimit.usage / highestLimit.limit) * 100);
    const isCritical = usagePercent >= limitThresholds.danger;

    function handleInfoClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.CLOUD_LIMITS,
            dialogType: LHSNearingLimitsModal,
        }));
    }

    return (
        <>
            <Menu.Separator/>
            <li
                className={classNames('globalHeader-leftControls-productSwitcherMenu-cloudLimitsFooter', {
                    usageAboveDangerThreshold: isCritical,
                })}
            >
                <div className='footerTitle'>
                    {words.title}
                    <button
                        className='btn btn-icon btn-xs btn-quaternary'
                        aria-label={intl.formatMessage({
                            id: 'globalHeader.productSwitcherMenu.cloudLimitsFooter.infoButtonAriaLabel',
                            defaultMessage: 'View limits',
                        })}
                        onClick={handleInfoClick}
                    >
                        <i
                            className='icon icon-information-outline'
                        />
                    </button>
                </div>
                <div className='footerDescription'>
                    {words.description}
                </div>
                <div className='footerUsage'>
                    <UsagePercentBar percent={usagePercent}/>
                    <span className='footerUsageLabel'>
                        {words.status}
                    </span>
                </div>
            </li>
        </>
    );
}

