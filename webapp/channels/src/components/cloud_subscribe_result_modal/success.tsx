// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';

import IconMessage from 'components/purchase_modal/icon_message';

import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {closeModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';

import './style.scss';

type Props = {
    onHide?: () => void;
    newProductName?: string;
};

function SuccessModal(props: Props) {
    const dispatch = useDispatch();
    const subscriptionProduct = useSelector(getSubscriptionProduct);

    const isSuccessModalOpen = useSelector((state: GlobalState) =>
        isModalOpen(state, ModalIdentifiers.SUCCESS_MODAL),
    );

    const onHide = () => {
        dispatch(closeModal(ModalIdentifiers.SUCCESS_MODAL));
        if (typeof props.onHide === 'function') {
            props.onHide();
        }
    };

    return (
        <FullScreenModal
            show={isSuccessModalOpen}
            onClose={onHide}
        >
            <div className='cloud_subscribe_result_modal'>
                <IconMessage
                    formattedTitle={
                        <FormattedMessage
                            defaultMessage={
                                'You are now subscribed to {selectedProductName}'
                            }
                            id={
                                'admin.billing.subscription.proratedPayment.title'
                            }
                            values={{
                                selectedProductName: props.newProductName ?? subscriptionProduct?.name,
                            }}
                        />
                    }
                    formattedSubtitle={
                        <FormattedMessage
                            id={'success_modal.subtitle'}
                            defaultMessage={
                                'Your final bill will be prorated. Your workspace now has {plan} limits.'
                            }
                            values={{plan: props.newProductName ?? subscriptionProduct?.name}}
                        />
                    }
                    error={false}
                    icon={
                        <PaymentSuccessStandardSvg
                            width={444}
                            height={313}
                        />
                    }
                    formattedButtonText={
                        <FormattedMessage
                            defaultMessage={'Return to workspace'}
                            id={'success_modal.return_to_workspace'}
                        />
                    }
                    buttonHandler={onHide}
                    className={'success'}
                />
            </div>
        </FullScreenModal>
    );
}

export default SuccessModal;
