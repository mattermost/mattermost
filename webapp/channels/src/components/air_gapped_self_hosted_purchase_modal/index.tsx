// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {LegacyGenericModal} from '@mattermost/components';
import {CloudLinks} from 'utils/constants';
import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import {useControlAirGappedSelfHostedPurchaseModal} from 'components/common/hooks/useControlModal';

import './content.scss';

export default function AirGappedSelfHostedPurhcaseModal() {
    const {close} = useControlAirGappedSelfHostedPurchaseModal();

    return (
        <LegacyGenericModal
            onExited={close}
            show={true}
            className='air-gapped-purchase-modal'
        >
            <div className='content'>
                <CreditCardSvg
                    height={350}
                    width={350}
                />
                <span id='air-gapped-modal-title'>
                    <FormattedMessage
                        id={'self_hosted_signup.air_gapped_title'}
                        defaultMessage={'Purchase through the customer portal'}
                    />
                </span>
                <span id='air-gapped-modal-content'>
                    <FormattedMessage
                        id={'self_hosted_signup.air_gapped_content'}
                        defaultMessage={'It appears that your instance is air-gapped, or it may not be connected to the internet. To purchase a license, please visit'}
                    />
                </span>
                <a href={CloudLinks.SELF_HOSTED_PRICING}>{CloudLinks.SELF_HOSTED_PRICING}</a>
            </div>
        </LegacyGenericModal>
    );
}
