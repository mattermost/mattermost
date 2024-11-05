// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {trackEvent} from 'actions/telemetry_actions';

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
        trackEvent('admin', props.eventID || 'in_trial_purchase_license');

        openSalesLink();
    };

    return (
        <button
            id={props.eventID}
            className={'annnouncementBar__purchaseNow'}
            onClick={handlePurchaseLinkClick}
        >
            {props.buttonTextElement}
        </button>
    );
};

export default PurchaseLink;
