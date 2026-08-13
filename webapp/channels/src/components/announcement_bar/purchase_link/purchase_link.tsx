// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Button} from '@mattermost/shared/components/button';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import './purchase_link.scss';

export interface Props {
    buttonTextElement: JSX.Element;
    eventID?: string;
}

const PurchaseLink: React.FC<Props> = (props: Props) => {
    const [openSalesLink] = useOpenSalesLink();

    const handlePurchaseLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        openSalesLink();
    };

    return (
        <Button
            id={props.eventID}
            emphasis='tertiary'
            size='xs'
            variant='inverted'
            className='annnouncementBar__purchaseNow'
            onClick={handlePurchaseLinkClick}
        >
            {props.buttonTextElement}
        </Button>
    );
};

export default PurchaseLink;
