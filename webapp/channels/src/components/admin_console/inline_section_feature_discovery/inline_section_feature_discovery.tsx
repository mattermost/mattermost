// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {LicenseSkuBadge} from 'components/widgets/badges';

import {LicenseSkus} from 'utils/constants';
import {goToMattermostContactSalesForm} from 'utils/contact_support_sales';

import './inline_section_feature_discovery.scss';

type Props = {
    featureName: string;
    title: MessageDescriptor;
    description: MessageDescriptor;
    learnMoreURL: string;
    svgImage?: React.ComponentType<{width?: number; height?: number}>;
};

const InlineSectionFeatureDiscovery: React.FC<Props> = ({
    featureName,
    title,
    description,
    learnMoreURL,
    svgImage: SvgImage,
}) => {
    const handleContactSales = (e: React.MouseEvent) => {
        e.preventDefault();

        // Customer data is not available in this context; tracking is handled via source and medium
        goToMattermostContactSalesForm('', '', '', '', featureName, 'in-product');
    };

    const handleLearnMore = (e: React.MouseEvent) => {
        e.preventDefault();
        window.open(learnMoreURL, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className='InlineSectionFeatureDiscovery'>
            <div className='InlineSectionFeatureDiscovery__content'>
                <div className='InlineSectionFeatureDiscovery__badge'>
                    <LicenseSkuBadge sku={LicenseSkus.EnterpriseAdvanced}/>
                </div>
                <h4 className='InlineSectionFeatureDiscovery__title'>
                    <FormattedMessage {...title}/>
                </h4>
                <p className='InlineSectionFeatureDiscovery__description'>
                    <FormattedMessage {...description}/>
                </p>
                <div className='InlineSectionFeatureDiscovery__actions'>
                    <button
                        className='btn btn-primary'
                        onClick={handleContactSales}
                    >
                        <FormattedMessage
                            id='admin.feature_discovery.contact_sales'
                            defaultMessage='Contact sales'
                        />
                    </button>
                    <button
                        className='btn btn-tertiary'
                        onClick={handleLearnMore}
                    >
                        <FormattedMessage
                            id='admin.feature_discovery.learn_more'
                            defaultMessage='Learn more'
                        />
                    </button>
                </div>
            </div>
            {SvgImage && (
                <div className='InlineSectionFeatureDiscovery__image'>
                    <SvgImage
                        width={270}
                        height={164}
                    />
                </div>
            )}
        </div>
    );
};

export default InlineSectionFeatureDiscovery;

