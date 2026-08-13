// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {LicenseSkuBadge} from 'components/widgets/badges';

import './admin_section_panel.scss';

type Props = {
    title?: string | MessageDescriptor;
    description?: string | MessageDescriptor;
    licenseSku?: string;
    children: React.ReactNode;
    'data-testid'?: string;
};

const AdminSectionPanel: React.FC<Props> = ({
    title,
    description,
    licenseSku,
    children,
    'data-testid': dataTestId,
}) => {
    return (
        <div
            className='AdminSectionPanel'
            data-testid={dataTestId}
        >
            {(title || description) && (
                <div className='AdminSectionPanel__header'>
                    {title && (
                        <h3 className='AdminSectionPanel__title'>
                            {typeof title === 'string' ? (
                                title
                            ) : (
                                <FormattedMessage {...title}/>
                            )}
                            {licenseSku && <LicenseSkuBadge sku={licenseSku}/>}
                        </h3>
                    )}
                    {description && (
                        <div
                            data-testid='admin-section-panel-description'
                            className='AdminSectionPanel__description'
                        >
                            {typeof description === 'string' ? (
                                description
                            ) : (
                                <FormattedMessage {...description}/>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div
                data-testid='admin-section-panel-body'
                className='AdminSectionPanel__body'
            >
                {children}
            </div>
        </div>
    );
};

export default AdminSectionPanel;

