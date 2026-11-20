// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '../aria/matchers';
import type {App} from '../ui/generated';
import {duration} from '../util';

type PolicyEditor = App['admin']['accessControl']['policy'] | App['admin']['permissionPolicy'];

/** Switches to the CEL editor and types an expression, waiting for validation. */
export async function setCelExpression(_app: App, policy: PolicyEditor, expression: string): Promise<void> {
    await expect(policy.switchModeButton).toBeVisible();
    await expect(policy.switchModeButton).toBeEnabled({timeout: duration.one_min});
    if (!(await policy.cel.input.isVisible())) {
        await policy.switchModeButton.click();
    }
    await expect(policy.cel.input).toBeVisible();

    // Monaco owns its native textbox; focus it directly before selecting and replacing the expression.
    const editor = policy.cel.input.locator.getByRole('textbox');
    await editor.focus();
    await editor.press('ControlOrMeta+a');
    await expect(editor).toBeFocused();

    // Monaco pairs brackets and quotes, so pace input to preserve overtyped closing characters.
    await editor.type(expression, {delay: 10});
    await expect(policy.cel.statusText).toHaveText('Valid');
}
