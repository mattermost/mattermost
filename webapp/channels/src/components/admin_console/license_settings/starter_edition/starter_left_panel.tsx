// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RefObject} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {FileTypes} from 'utils/constants';

import './starter_edition.scss';
export interface StarterEditionProps {
    openEELicenseModal: () => void;
    currentPlan: JSX.Element;
    upgradedFromTE: boolean;
    fileInputRef: RefObject<HTMLInputElement>;
    handleChange: () => void;
}

const StarterLeftPanel: React.FC<StarterEditionProps> = ({
    openEELicenseModal,
    currentPlan,
    upgradedFromTE,
    fileInputRef,
    handleChange,
}: StarterEditionProps) => {
    const openPricingModal = useOpenPricingModal();
    const intl = useIntl();

    const viewPlansButton = (
        <button
            id='starter_edition_view_plans'
            onClick={() => openPricingModal({trackingLocation: 'license_settings_view_plans'})}
            className='btn btn-secondary PlanDetails__viewPlansButton'
        >
            {intl.formatMessage({
                id: 'workspace_limits.menu_limit.view_plans',
                defaultMessage: 'View plans',
            })}
        </button>
    );

    return (
        <div className='StarterLeftPanel'>
            {viewPlansButton}
            <div className='pre-title'>
                <FormattedMessage
                    id='admin.license.enterpriseEdition'
                    defaultMessage='Enterprise Edition'
                />
            </div>
            <div className='title'>
                <FormattedMessage
                    id='admin.license.freeEdition.title'
                    defaultMessage='Free'
                />
            </div>
            <div className='currentPlanLegend'>
                {currentPlan}
            </div>
            <div className='subtitle'>
                <FormattedMessage
                    id='admin.license.freeEdition.subtitle'
                    defaultMessage='Purchase Professional or Enterprise to unlock enterprise features.'
                />
            </div>
            <hr/>
            <div className='content'>
                {upgradedFromTE ? <>
                    <p>
                        {'When using Mattermost Enterprise Edition, the software is offered under a commercial license. See '}
                        <a
                            role='button'
                            onClick={openEELicenseModal}
                            className='openEELicenseModal'
                        >
                            {'here'}
                        </a>
                        {' for “Enterprise Edition License” for details. '}
                        {'See NOTICE.txt for information about open source software used in the system.'}
                    </p>
                </> : <p>
                    {'This software is offered under a commercial license.\n\nSee ENTERPRISE-EDITION-LICENSE.txt in your root install directory for details. See NOTICE.txt for information about open source software used in this system.'}
                </p>
                }
            </div>
            <div className='licenseInformation'>
                <div
                    className='licenseKeyTitle'
                >
                    <FormattedMessage
                        id='admin.license.key'
                        defaultMessage='License Key: '
                    />
                </div>
                <div className='uploadButtons'>
                    <button
                        className='btn btn-upload light-blue-btn'
                        onClick={() => fileInputRef.current?.click()}
                        id='open-modal'
                    >
                        <FormattedMessage
                            id='admin.license.uploadFile'
                            defaultMessage='Upload File'
                        />
                    </button>
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept={FileTypes.LICENSE_EXTENSION}
                        onChange={handleChange}
                        style={{display: 'none'}}
                    />
                </div>
            </div>
        </div>
    );
};

export default React.memo(StarterLeftPanel);
