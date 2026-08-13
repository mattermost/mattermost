// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import './renew_link.scss';

export interface RenewalLinkProps {
    isDisabled?: boolean;
}

const RenewalLink = (props: RenewalLinkProps) => {
    const [openContactSales] = useOpenSalesLink();

    const handleLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        openContactSales();
    };

    const btnText = (
        <FormattedMessage
            id='announcement_bar.warn.renew_license_contact_sales'
            defaultMessage='Contact sales'
        />
    );

    return (
        <Button
            emphasis='tertiary'
            size='xs'
            variant='inverted'
            className='annnouncementBar__renewLicense'
            disabled={props.isDisabled}
            onClick={(e) => handleLinkClick(e)}
        >
            {btnText}
        </Button>
    );
};

export default RenewalLink;
