// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import './link.scss';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

export interface UpgradeLinkProps {
    telemetryInfo?: string;
    buttonText?: string;
    styleButton?: boolean; // show as a blue primary button
    styleLink?: boolean; // show as a anchor link
}

const UpgradeLink = (props: UpgradeLinkProps) => {
    const styleButton = props.styleButton ? ' style-button' : '';
    const styleLink = props.styleLink ? ' style-link' : '';

    const [openSalesLink] = useOpenSalesLink();

    const handleLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (props.telemetryInfo) {
            trackEvent('upgrade_mm_cloud', props.telemetryInfo);
        }
        openSalesLink();
    };
    const buttonText = (
        <FormattedMessage
            id='upgradeLink.warn.upgrade_now'
            defaultMessage='Upgrade now'
        />
    );
    return (
        <button
            className={`upgradeLink${styleButton}${styleLink}`}
            onClick={(e) => handleLinkClick(e)}
        >
            {props.buttonText ? props.buttonText : buttonText}
        </button>
    );
};

export default UpgradeLink;
