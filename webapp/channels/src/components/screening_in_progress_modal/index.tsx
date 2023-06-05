// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import AccessDeniedHappySvg from 'components/common/svg_images_components/access_denied_happy_svg';
import {useControlScreeningInProgressModal} from 'components/common/hooks/useControlModal';

import './content.scss';

export default function ScreeningInProgressModal() {
    const {close} = useControlScreeningInProgressModal();

    return (
        <GenericModal
            onExited={close}
            show={true}
            className='ScreeningInProgressModal'
            handleCancel={close}
            cancelButtonClassName='ScreeningInProgressModal__close'
            cancelButtonText={(
                <FormattedMessage
                    id='self_hosted_signup.close'
                    defaultMessage='Close'
                />
            )}
            autoCloseOnCancelButton={true}
            compassDesign={true}
        >
            <div className='ScreeningInProgressModal__content'>
                <div className='ScreeningInProgressModal__illustration'>
                    <AccessDeniedHappySvg
                        height={350}
                        width={350}
                    />
                </div>
                <div className='ScreeningInProgressModal__title'>
                    <FormattedMessage
                        id={'self_hosted_signup.screening_title'}
                        defaultMessage={'Your transaction is being reviewed'}
                    />
                </div>
                <div className='ScreeningInProgressModal__description'>
                    <FormattedMessage
                        id={'self_hosted_signup.screening_description'}
                        defaultMessage={'We will check things on our side and get back to you within 3 days once your license is approved. In the meantime, please feel free to continue using the free version of our product.'}
                    />
                </div>
            </div>
        </GenericModal>
    );
}
