// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {isProductSidebarEnabled} from 'selectors/views/product_sidebar';

import {TeamSection} from './team_section';

import './product_sidebar.scss';

const ProductSidebar = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const isEnabled = useSelector(isProductSidebarEnabled);

    if (!isEnabled) {
        return null;
    }

    return (
        <nav
            className="ProductSidebar"
            role="navigation"
            aria-label={formatMessage({id: 'product_sidebar.ariaLabel', defaultMessage: 'Product sidebar'})}
        >
            <div className="ProductSidebar__topSection">
                <TeamSection />
                {/* Product navigation - Phase 3 */}
            </div>
            <div className="ProductSidebar__bottomSection">
                {/* Utility buttons - Phase 5 */}
                {/* User avatar - Phase 5 */}
            </div>
        </nav>
    );
};

export default ProductSidebar;
