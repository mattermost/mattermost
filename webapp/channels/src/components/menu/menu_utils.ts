// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ELEMENT_ID_FOR_MENU_BACKDROP} from './menu';

/**
 * Since the menu component requires actual interaction with the button
 * of the menu for opening the menus, we trigger it from here by clicking on the menu button
 */
export function openMenu(buttonId: string) {
    const menuButton = document.getElementById(buttonId);
    if (!menuButton) {
        return;
    }

    menuButton.click();
}

/**
 * Dismisses the menu by clicking on the backdrop
 */
export function dismissMenu() {
    const menuOverlay = document.getElementById(ELEMENT_ID_FOR_MENU_BACKDROP);
    if (!menuOverlay) {
        return;
    }

    menuOverlay.click();
}
