// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** The testid roles, as the runtime reads them from the grammar. */
export const ROLES = [
    'button',
    'link',
    'textbox',
    'searchbox',
    'checkbox',
    'switch',
    'radio',
    'radiogroup',
    'combobox',
    'listbox',
    'option',
    'tab',
    'tablist',
    'tabpanel',
    'menu',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'dialog',
    'alertdialog',
    'slider',
    'spinbutton',
    'togglebutton',
    'text',
    'img',
    'list',
    'listitem',
    'row',
    'grid',
    'gridcell',
    'status',
    'alert',
    'tooltip',
    'region',
    'separator',
] as const;

export type Role = (typeof ROLES)[number];
