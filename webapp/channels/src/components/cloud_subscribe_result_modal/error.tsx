// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';

import IconMessage from 'components/purchase_modal/icon_message';

import FullScreenModal from 'components/widgets/modals/full_screen_modal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {InquiryType} from 'selectors/cloud';
import {closeModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';

import './style.scss';

type Props = {
    onHide?: () => void;
    backButtonAction?: () => void;
};

function ErrorModal(props: Props) {
    const dispatch = useDispatch();
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const openContactUs = useOpenSalesLink(undefined, InquiryType.Technical);

    const isSuccessModalOpen = useSelector((state: GlobalState) =>
        isModalOpen(state, ModalIdentifiers.ERROR_MODAL),
    );

    const onBackButtonPress = () => {
        if (props.backButtonAction) {
            props.backButtonAction();
        }
        dispatch(closeModal(ModalIdentifiers.ERROR_MODAL));
    };

    const onHide = () => {
        dispatch(closeModal(ModalIdentifiers.ERROR_MODAL));
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
                            defaultMessage={'We were unable to change your plan'}
                            id={'error_modal.title'}
                            values={{
                                selectedProductName: subscriptionProduct?.name,
                            }}
                        />
                    }
                    formattedSubtitle={
                        <FormattedMessage
                            id={'error_modal.subtitle'}
                            defaultMessage={
                                'An error occurred while changing your plan. Please go back and try again, or contact the support team.'
                            }
                            values={{plan: subscriptionProduct?.name}}
                        />
                    }
                    error={true}
                    icon={
                        <PaymentFailedSvg
                            width={444}
                            height={313}
                        />
                    }
                    formattedButtonText={
                        <FormattedMessage
                            defaultMessage={'Try again'}
                            id={'error_modal.try_again'}
                        />
                    }
                    formattedTertiaryButonText={
                        <FormattedMessage
                            defaultMessage={'Contact Support'}
                            id={
                                'admin.billing.subscription.privateCloudCard.contactSupport'
                            }
                        />
                    }
                    tertiaryButtonHandler={openContactUs}
                    buttonHandler={onBackButtonPress}
                    className={'success'}
                />
            </div>
        </FullScreenModal>
    );
}

export default ErrorModal;
