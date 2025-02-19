// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as Menu from 'components/menu';

export default function ProductSwitcherCloudTrialMenuItem() {
    return (
        <Menu.Item
            className='product-switcher-products-menu-item'

            // leadingElement={(
            //     <Icon
            //         size={24}
            //         aria-hidden='true'
            //     />
            // )}
            labels={(
                <>
                    <FormattedMessage
                        id='menu.cloudFree.postTrial.ddd'
                        defaultMessage='See plans'
                    />
                    <FormattedMessage
                        id='menu.cloudFree.postTrial.tryEnterprise'
                        defaultMessage='Interested in a limitless plan with high-security features? <openModalLink>See plans</openModalLink>'
                        values={
                            {
                                openModalLink: (msg: string) => (
                                    <a
                                        className='open-see-plans-modal style-link'

                                        // onClick={() => openPricingModal({trackingLocation: 'menu_cloud_trial'})}
                                    >
                                        {msg}
                                    </a>
                                ),
                            }
                        }
                    />
                </>
            )}

            // onClick={handleClick}
        />
    );
}
