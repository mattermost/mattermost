// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import './purchase_link.scss';

export interface Props {
    buttonTextElement: JSX.Element;
    eventID?: string;
    className?: string;
}

const PurchaseLink: React.FC<Props> = (props: Props) => {
    const [openSalesLink] = useOpenSalesLink();

    const handlePurchaseLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        openSalesLink();
    };

    // Default classes for feature discovery context
    const defaultClassName = 'btn btn-primary';

    // Use provided className or default
    const buttonClassName = props.className || defaultClassName;

    return (
        <button
            id={props.eventID}
            className={buttonClassName}
            onClick={handlePurchaseLinkClick}
        >
            {props.buttonTextElement}
        </button>
    );
};

export default PurchaseLink;
