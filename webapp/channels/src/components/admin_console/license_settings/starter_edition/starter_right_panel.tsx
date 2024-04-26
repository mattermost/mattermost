// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import WomanUpArrowsAndCloudsSvg from 'components/common/svg_images_components/woman_up_arrows_and_clouds_svg';

const StarterRightPanel = () => {
    const upgradeAdvantages = [
        'OneLogin/ADFS SAML 2.0',
        'OpenID Connect',
        'Office365 suite integration',
        'Read-only announcement channels',
        'And more...',
    ];

    return (
        <div className='StarterEditionRightPannel'>
            <div className='svg-image'>
                <WomanUpArrowsAndCloudsSvg
                    width={200}
                    height={200}
                />
            </div>
            <div className='upgrade-title'>
                <FormattedMessage
                    id='admin.license.upgradeTitle'
                    defaultMessage='Upgrade to the Professional Plan'
                />
            </div>
            <div className='advantages-list'>
                {upgradeAdvantages.map((item: string, i: number) => {
                    return (
                        <div
                            className='item'
                            key={i.toString()}
                        >
                            <i className='fa fa-lock'/>{item}
                        </div>
                    );
                })}
            </div>
            <div className='purchase_buttons'>
                <ContactUsButton
                    eventID='post_trial_contact_sales'
                />
            </div>
        </div>
    );
};

export default memo(StarterRightPanel);
