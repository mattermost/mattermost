// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

/**
 * Advanced-mode CEL editor. Monaco keeps the editable text in textarea.inputarea
 * and paints the visible lines separately.
 */
export default class CelEditor {
    readonly container: Locator;
    readonly lines: Locator;
    readonly input: Locator;

    constructor(root: Locator) {
        this.container = root.locator('.cel-editor');
        this.lines = this.container.locator('.monaco-editor .view-lines');
        this.input = this.container.locator('.monaco-editor textarea.inputarea');
    }
}
