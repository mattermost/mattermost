// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getCloudSubscription, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import * as Menu from 'components/menu';
import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {ModalIdentifiers, CloudProducts} from 'utils/constants';

export default function ProductSwitcherCloudTrialMenuItem() {
    const dispatch = useDispatch();
    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    const license = useSelector(getLicense);
    const isCloud = license?.Cloud === 'true';

    const subscription = useSelector(getCloudSubscription);
    const freeTrialEndDay = moment(subscription?.trial_end_at).format('MMMM DD');

    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const isStarter = subscriptionProduct?.sku === CloudProducts.STARTER;
    const someLimitNeedsAttention = useGetHighestThresholdCloudLimit(useGetUsage(), useGetLimits()[0]);

    const openPricingModal = useOpenPricingModal();

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    if (!isCloud) {
        return null;
    }

    if (Boolean(someLimitNeedsAttention) || (!isStarter && !isFreeTrial)) {
        return null;
    }

    // for end users only display the trial information
    if (!isAdmin && !isFreeTrial) {
        return null;
    }

    let labels;
    if (isFreeTrial) {
        labels = (
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
    } else {
        // menu option displayed when the workspace is not running any trial
        labels = (
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
    }

    function openTrialBenefitsModal() {
        dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
        }));
    }

    return (
        <>
            <Menu.Separator/>
            <Menu.Item
                className='product-switcher-products-menu-item'

                // leadingElement={(
                //     <Icon
                //         size={24}
                //         aria-hidden='true'
                //     />
                // )}
                labels={labels}
            />
        </>
    );
}
