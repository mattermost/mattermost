// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getIsLhsOpen} from 'selectors/lhs';
import {getIsMobileView} from 'selectors/views/browser';
import {isProductSidebarEnabled} from 'selectors/views/product_sidebar';

import {ProductSection} from './product_section';
import {SearchButton} from './search_button';
import {TeamSection} from './team_section';
import {UserSection} from './user_section';
import {UtilitySection} from './utility_section';

import './product_sidebar.scss';

const ProductSidebar = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const isEnabled = useSelector(isProductSidebarEnabled);
    const isLhsOpen = useSelector(getIsLhsOpen);
    const isMobileView = useSelector(getIsMobileView);

    if (!isEnabled) {
        return null;
    }

    return (
        <nav
            className={classNames('ProductSidebar', {
                'move--right': isLhsOpen && isMobileView,
            })}
            role='navigation'
            aria-label={formatMessage({id: 'product_sidebar.ariaLabel', defaultMessage: 'Product sidebar'})}
        >
            <div className='ProductSidebar__topSection'>
                <TeamSection/>
                <SearchButton/>
                <ProductSection/>
            </div>
            <div className='ProductSidebar__bottomSection'>
                <UtilitySection/>
                <UserSection/>
            </div>
        </nav>
    );
};

export default ProductSidebar;
