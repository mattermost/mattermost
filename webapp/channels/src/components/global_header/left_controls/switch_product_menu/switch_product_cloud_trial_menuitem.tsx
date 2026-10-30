// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';
import {FormattedDate, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ArrowUpBoldCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';

import {openModal} from 'actions/views/modals';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import * as Menu from 'components/menu';
import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {ModalIdentifiers} from 'utils/constants';

interface Props {
    isUserAdmin: boolean;
    isCloudLicensed: boolean;
    isFreeTrialSubscription: boolean;
}

export default function ProductSwitcherCloudTrialMenuItem(props: Props) {
    const dispatch = useDispatch();

    const subscription = useSelector(getCloudSubscription);

    const {openPricingModal, isAirGapped} = useOpenPricingModal();

    if (!props.isCloudLicensed || !props.isFreeTrialSubscription) {
        return null;
    }

    // Don't show if air-gapped (no internet access for pricing modal)
    if (isAirGapped) {
        return null;
    }

    function handleDiscoverEnterpriseFeaturesClick() {
        if (props.isUserAdmin) {
            dispatch(
                openModal({
                    modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
                    dialogType: TrialBenefitsModal,
                }),
            );
        } else {
            openPricingModal();
        }
    }

    return (
        <Menu.Item
            className='globalHeader-leftControls-productSwitcherMenu-trialMenuItem'
            leadingElement={<ArrowUpBoldCircleOutlineIcon size={18}/>}
            labels={
                <>
                    <FormattedMessage
                        id='globalHeader.productSwitcherMenu.trialMenuItem.isFreeTrial.primaryLabel'
                        defaultMessage='Enterprise Advanced Trial'
                    />
                    <FormattedMessage
                        id='globalHeader.productSwitcherMenu.trialMenuItem.isFreeTrial.secondaryLabel'
                        defaultMessage='Your trial is active until {trialEndDay}. Discover our top Enterprise features.'
                        values={{
                            trialEndDay: (
                                <FormattedDate
                                    value={moment(subscription?.trial_end_at).toDate()}
                                    year='numeric'
                                    month='long'
                                    day='2-digit'
                                />
                            ),
                        }}
                    />
                </>
            }
            onClick={handleDiscoverEnterpriseFeaturesClick}
        />
    );
}
