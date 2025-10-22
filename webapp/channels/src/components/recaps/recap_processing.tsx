// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Recap} from '@mattermost/types/recaps';

type Props = {
    recap: Recap;
};

const RecapProcessing = ({recap}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className='recap-processing'>
            <div className='recap-processing-card'>
                <div className='recap-processing-header'>
                    <h2 className='recap-processing-title'>{recap.title}</h2>
                    <div className='recap-processing-subtitle'>
                        {formatMessage({id: 'recaps.processing.subtitle', defaultMessage: "Recap created. You'll receive a summary shortly"})}
                    </div>
                </div>

                <div className='recap-processing-content'>
                    <div className='recap-processing-spinner'>
                        <div className='spinner-large'/>
                    </div>
                    <p className='recap-processing-message'>
                        {formatMessage({id: 'recaps.processing.message', defaultMessage: 'We\'re working on your recap. Check back shortly'})}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RecapProcessing;

