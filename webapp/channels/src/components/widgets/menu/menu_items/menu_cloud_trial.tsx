// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import moment from 'moment';

import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';
import LearnMoreTrialModal from 'components/learn_more_trial_modal/learn_more_trial_modal';

import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {getCloudSubscription, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers, CloudProducts} from 'utils/constants';
import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';

import './menu_item.scss';

type Props = {
    id: string;
}
const MenuCloudTrial = ({id}: Props): JSX.Element | null => {
    const subscription = useSelector(getCloudSubscription);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const license = useSelector(getLicense);
    const dispatch = useDispatch<DispatchFunc>();

    const isCloud = license?.Cloud === 'true';
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const noPriorTrial = !(subscription?.is_free_trial === 'false' && subscription?.trial_end_at > 0);
    const freeTrialEndDay = moment(subscription?.trial_end_at).format('MMMM DD');
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const openPricingModal = useOpenPricingModal();

    const openTrialBenefitsModal = async () => {
        await dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
        }));
    };

    const openLearnMoreTrialModal = async () => {
        await dispatch(openModal({
            modalId: ModalIdentifiers.LEARN_MORE_TRIAL_MODAL,
            dialogType: LearnMoreTrialModal,
            dialogProps: {
                launchedBy: 'main_menu_cloud_trial',
            },
        }));
    };

    const someLimitNeedsAttention = Boolean(useGetHighestThresholdCloudLimit(useGetUsage(), useGetLimits()[0]));

    if (!isCloud) {
        return null;
    }

    const isStarter = subscriptionProduct?.sku === CloudProducts.STARTER;

    if (someLimitNeedsAttention || (!isStarter && !isFreeTrial)) {
        return null;
    }

    // for end users only display the trial information
    if (!isAdmin && !isFreeTrial) {
        return null;
    }

    const freeTrialContent = (
        <div className='MenuCloudTrial__free-trial'>
            <h5 className='MenuCloudTrial__free-trial__content-title'>
                <FormattedMessage
                    id='menu.cloudFree.enterpriseTrialTitle'
                    defaultMessage='Enterprise Trial'
                />
            </h5>
            <div className='MenuCloudTrial__free-trial__content-section'>
                <div className='MenuCloudTrial__free-trial__content-section__icon-section'>
                    <i className='icon-arrow-up-bold-circle-outline'/>
                </div>
                <FormattedMessage
                    id='menu.cloudFree.enterpriseTrialDescription'
                    defaultMessage='Your trial is active until {trialEndDay}. Discover our top Enterprise features. <openModalLink>Learn more</openModalLink>'
                    values={
                        {
                            trialEndDay: freeTrialEndDay,
                            openModalLink: (msg: string) => (
                                <a
                                    className='open-trial-benefits-modal style-link'
                                    onClick={isAdmin ? openTrialBenefitsModal : () => openPricingModal({trackingLocation: 'menu_cloud_trial'})}
                                >
                                    {msg}
                                </a>
                            ),
                        }
                    }
                />
            </div>
        </div>
    );

    // menu option displayed when the workspace is not running any trial
    const noFreeTrialContent = noPriorTrial ? (
        <FormattedMessage
            id='menu.cloudFree.priorTrial.tryEnterprise'
            defaultMessage='Interested in a limitless plan with high-security features? <openModalLink>Try Enterprise free for 30 days</openModalLink>'
            values={
                {
                    openModalLink: (msg: string) => (
                        <a
                            className='open-learn-more-trial-modal style-link'
                            onClick={openLearnMoreTrialModal}
                        >
                            {msg}
                        </a>
                    ),
                }
            }
        />
    ) : (
        <FormattedMessage
            id='menu.cloudFree.postTrial.tryEnterprise'
            defaultMessage='Interested in a limitless plan with high-security features? <openModalLink>See plans</openModalLink>'
            values={
                {
                    openModalLink: (msg: string) => (
                        <a
                            className='open-see-plans-modal style-link'
                            onClick={() => openPricingModal({trackingLocation: 'menu_cloud_trial'})}
                        >
                            {msg}
                        </a>
                    ),
                }
            }
        />
    );

    return (
        <li
            className='MenuCloudTrial'
            role='menuitem'
            id={id}
        >
            {isFreeTrial ? freeTrialContent : noFreeTrialContent}
        </li>
    );
};
export default MenuCloudTrial;
