// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';
import {useLocation} from 'react-router-dom';

import {isProductRailShown} from 'selectors/views/product_rail';

import {isBackstagePath} from 'utils/path';

/** Whether the product rail is on screen: where the store allows it, except on backstage pages. */
export default function useProductRailShown(): boolean {
    const shown = useSelector(isProductRailShown);
    const {pathname} = useLocation();
    return shown && !isBackstagePath(pathname);
}
