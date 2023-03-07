// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

interface Props {
    agreed: boolean;
    setAgreed: (agreed: boolean) => void;
}

import {HostedCustomerLinks} from 'utils/constants';

export default function Terms(props: Props) {
    return (
        <div className='form-row'>
            <div className='self-hosted-agreed-terms'>
                <label>
                    <input
                        id='self_hosted_purchase_terms'
                        type='checkbox'
                        checked={props.agreed}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            props.setAgreed(e.target.checked);
                        }}
                    />
                    <div>
                        <FormattedMessage
                            id='self_hosted_signup.disclaimer'
                            defaultMessage='I have read and agree to the <a>Enterprise Edition Subscription Terms</a>'
                            values={{
                                a: (chunks: React.ReactNode) => {
                                    return (
                                        <a
                                            href={HostedCustomerLinks.TERMS_AND_CONDITIONS}
                                            target='_blank'
                                            rel='noreferrer'
                                        >
                                            {chunks}
                                        </a>
                                    );
                                },
                            }}
                        />
                    </div>
                </label>
            </div>
        </div>
    );
}
