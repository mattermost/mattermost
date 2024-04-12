// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';
import store from 'stores/redux_store';

import {ModalIdentifiers} from 'utils/constants';

import SubMenuModal from './menu_modals/submenu_modal/submenu_modal';

/**
 * @deprecated This is a horrible hack that shouldn't used done elsewhere because we shouldn't be accessing the global
 * store directly, but it's too hard to get this value into these component properly without rewriting everything.
 * These components will eventually be replaced by the newer components in `components/menu` anyway.
 */
export function isMobile() {
    return getIsMobileView(store.getState());
}

/**
 * @deprecated
 */
export function showMobileSubMenuModalHack(elements: any[]) { // TODO Use more specific type
    const submenuModalData = {
        modalId: ModalIdentifiers.MOBILE_SUBMENU,
        dialogType: SubMenuModal,
        dialogProps: {
            elements,
        },
    };

    store.dispatch(openModal(submenuModalData));
}
