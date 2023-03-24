// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import {FormattedMessage} from 'react-intl';

import {DispatchFunc} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';
import {trackEvent} from 'actions/telemetry_actions';
import {ModalIdentifiers} from 'utils/constants';
import PurchaseModal from 'components/purchase_modal';

import './link.scss';

export interface UpgradeLinkProps {
    telemetryInfo?: string;
    buttonText?: string;
    styleButton?: boolean; // show as a blue primary button
    styleLink?: boolean; // show as a anchor link
}

const UpgradeLink = (props: UpgradeLinkProps) => {
    const dispatch = useDispatch<DispatchFunc>();
    const styleButton = props.styleButton ? ' style-button' : '';
    const styleLink = props.styleLink ? ' style-link' : '';

    const handleLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (props.telemetryInfo) {
            trackEvent('upgrade_mm_cloud', props.telemetryInfo);
        }
        try {
            dispatch(openModal({
                modalId: ModalIdentifiers.CLOUD_PURCHASE,
                dialogType: PurchaseModal,
                dialogProps: {
                    callerCTA: props.telemetryInfo,
                },
            }));
        } catch (error) {
            // do nothing
        }
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
