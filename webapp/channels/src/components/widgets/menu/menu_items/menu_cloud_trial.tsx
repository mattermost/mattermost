// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {type JSX} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {ModalIdentifiers} from 'utils/constants';

import './menu_item.scss';

type Props = {
    id: string;
};
const MenuCloudTrial = ({id}: Props): JSX.Element | null => {
    const subscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const dispatch = useDispatch();

    const isCloud = license?.Cloud === 'true';
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const freeTrialEndDay = moment(subscription?.trial_end_at).format('MMMM DD');
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const {openPricingModal, isAirGapped} = useOpenPricingModal();

    const openTrialBenefitsModal = async () => {
        await dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
        }));
    };

    if (!isCloud || !isFreeTrial) {
        return null;
    }

    // Don't show if air-gapped
    if (isAirGapped) {
        return null;
    }

    const freeTrialContent = (
        <div className='MenuCloudTrial__free-trial'>
            <h5 className='MenuCloudTrial__free-trial__content-title'>
                <FormattedMessage
                    id='menu.cloudFree.enterpriseTrialTitle'
                    defaultMessage='Enterprise Advanced Trial'
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
                            openModalLink: (msg) => (
                                <a
                                    className='open-trial-benefits-modal style-link'
                                    onClick={isAdmin ? openTrialBenefitsModal : () => openPricingModal()}
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

    return (
        <li
            className='MenuCloudTrial'
            role='menuitem'
            id={id}
        >
            {freeTrialContent}
        </li>
    );
};
export default MenuCloudTrial;
