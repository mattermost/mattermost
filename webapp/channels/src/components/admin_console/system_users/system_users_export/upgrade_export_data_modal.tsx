// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import useOpenPricingDetails from 'components/common/hooks/useOpenPricingDetails';
import SetupSystemSvg from 'components/common/svg_images_components/setup_system';
import ConfirmModalRedux from 'components/confirm_modal_redux';

import './upgrade_export_data_modal.scss';

type Props = {
    onExited: () => void;
}

export function UpgradeExportDataModal({onExited}: Props) {
    const openPricingDetails = useOpenPricingDetails();

    const confirm = () => {
        openPricingDetails({trackingLocation: 'upgrade_export_data_modal'});
    };

    const title = (
        <FormattedMessage
            id='upgrade_export_data_modal.title'
            defaultMessage='Upgrade to export data reports'
        />
    );

    const message = (
        <>
            <FormattedMessage
                id='upgrade_export_data_modal.desc'
                defaultMessage='Export detailed data reports with ease and analyse user statistics conveniently. Upgrade to the Professional plan to gain access to data export.'
            />
            <div className='upgrade-export-data-modal__svg-image'>
                <SetupSystemSvg
                    width={250}
                    height={188}
                />
            </div>
        </>
    );

    const viewPlansButton = (
        <FormattedMessage
            id='upgrade_export_data_modal.view_plans'
            defaultMessage='View Plans'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonText={viewPlansButton}
            onConfirm={confirm}
            onExited={onExited}
        />
    );
}
