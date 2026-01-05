// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {LicenseSkuBadge} from 'components/widgets/badges';

import './admin_section_panel.scss';

type Props = {
    title?: string;
    description?: string | MessageDescriptor;
    licenseSku?: string;
    children: React.ReactNode;
};

const AdminSectionPanel: React.FC<Props> = ({
    title,
    description,
    licenseSku,
    children,
}) => {
    return (
        <div className='AdminSectionPanel'>
            {(title || description) && (
                <div className='AdminSectionPanel__header'>
                    {title && (
                        <h3 className='AdminSectionPanel__title'>
                            {title}
                            {licenseSku && <LicenseSkuBadge sku={licenseSku}/>}
                        </h3>
                    )}
                    {description && (
                        <div className='AdminSectionPanel__description'>
                            {typeof description === 'string' ? (
                                description
                            ) : (
                                <FormattedMessage {...description}/>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className='AdminSectionPanel__body'>
                {children}
            </div>
        </div>
    );
};

export default AdminSectionPanel;

