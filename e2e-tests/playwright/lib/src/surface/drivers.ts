// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export class DestinationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DestinationError';
    }
}

export class SemanticRoleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SemanticRoleError';
    }
}

/** Shared deadline budget across multi-step actions (`clickTo`, `settle`). */
export class Deadline {
    private readonly endsAt: number;

    constructor(timeoutMs = 30_000) {
        this.endsAt = Date.now() + timeoutMs;
    }

    remaining(): number {
        return Math.max(1, this.endsAt - Date.now());
    }
}

export type TransitionTarget = Locator | {readonly locator: Locator; readonly testId?: string};

function targetLocator(target: TransitionTarget): Locator {
    return target instanceof ElementDriver ? target.locator : (typeof target.locator === 'function' ? target : target.locator) as Locator;
}

function targetLabel(target: TransitionTarget): string {
    return 'testId' in target && target.testId ? `"${target.testId}"` : 'destination';
}

export class ElementDriver {
    readonly locator: Locator;
    readonly testId: string;
    readonly role: string;

    constructor(scope: Page | Locator, testId: string, role = 'container', attr: 'data-testid' | 'data-surface' = 'data-testid') {
        this.testId = testId;
        this.role = role;
        this.locator = attr === 'data-surface' ? scope.locator(`[data-surface="${testId}"]`) : scope.getByTestId(testId);
    }

    async click(options?: {timeout?: number}): Promise<void> {
        await this.locator.click(options);
    }

    async press(key: string, options?: {timeout?: number}): Promise<void> {
        await this.locator.press(key, options);
    }

    async text(options?: {timeout?: number}): Promise<string> {
        return (await this.locator.textContent(options)) ?? '';
    }

    async toBeVisible(options?: {timeout?: number}): Promise<void> {
        await expect(this.locator).toBeVisible(options);
    }

    async toBeHidden(options?: {timeout?: number}): Promise<void> {
        await expect(this.locator).toBeHidden(options);
    }

    /** Click this element and wait for `destination` to appear within a single deadline. */
    async clickTo<T extends TransitionTarget>(
        destination: T,
        options: {timeout?: number; allowAlreadyVisible?: boolean} = {},
    ): Promise<T> {
        return this.transitionTo(destination, (timeout) => this.locator.click({timeout}), options);
    }

    /** Press a key on this element and wait for `destination` to appear within a single deadline. */
    async pressTo<T extends TransitionTarget>(
        key: string,
        destination: T,
        options: {timeout?: number; allowAlreadyVisible?: boolean} = {},
    ): Promise<T> {
        return this.transitionTo(destination, (timeout) => this.locator.press(key, {timeout}), options);
    }

    private async transitionTo<T extends TransitionTarget>(
        destination: T,
        trigger: (timeout: number) => Promise<void>,
        options: {timeout?: number; allowAlreadyVisible?: boolean},
    ): Promise<T> {
        const timeoutMs = options.timeout ?? 30_000;
        const deadline = new Deadline(timeoutMs);
        const destLoc = targetLocator(destination);
        if (!options.allowAlreadyVisible && await destLoc.isVisible()) {
            throw new DestinationError(`${targetLabel(destination)} was already visible before interacting with "${this.testId}"`);
        }
        await trigger(deadline.remaining());
        try {
            await expect(destLoc).toBeVisible({timeout: deadline.remaining()});
        } catch {
            throw new DestinationError(`Interacting with "${this.testId}" did not show ${targetLabel(destination)} within ${timeoutMs}ms`);
        }
        return destination;
    }
}

/** Verify at runtime that a rendered control exposes native or ARIA state semantics. */
export async function assertStateSemantics(locator: Locator, expectedRole: string, testId: string): Promise<void> {
    const ok = await locator.evaluate((el, role) => {
        const tag = el.tagName.toLowerCase();
        const ariaRole = el.getAttribute('role')?.split(/\s+/) ?? [];
        if (ariaRole.includes(role)) {
            return true;
        }
        if (tag === 'input') {
            const type = (el.getAttribute('type') ?? 'text').toLowerCase();
            return type === role && role !== 'switch';
        }
        return role === 'togglebutton' && tag === 'button' && el.hasAttribute('aria-pressed');
    }, expectedRole);
    if (!ok) {
        throw new SemanticRoleError(`Element "${testId}" does not expose rendered semantics for "--${expectedRole}"`);
    }
}

export class StateDriver extends ElementDriver {
    async isChecked(): Promise<boolean> {
        await assertStateSemantics(this.locator, this.role, this.testId);
        if (this.role === 'togglebutton') {
            return (await this.locator.getAttribute('aria-pressed')) === 'true';
        }
        return this.locator.isChecked();
    }

    async setChecked(checked: boolean): Promise<void> {
        await assertStateSemantics(this.locator, this.role, this.testId);
        if ((await this.isChecked()) !== checked) {
            if (this.role !== 'togglebutton') {
                const target = await this.locator.evaluate((el: HTMLElement) => {
                    const id = el.getAttribute('id');
                    if (id && el.ownerDocument.querySelector(`label[for=${JSON.stringify(id)}]`)) {
                        return id;
                    }
                    return el.closest('label') ? '__ancestor__' : null;
                });
                if (target === '__ancestor__') {
                    await this.locator.locator('xpath=ancestor::label[1]').click();
                    return;
                }
                if (typeof target === 'string' && target.length > 0) {
                    await this.locator.page().locator(`label[for=${JSON.stringify(target)}]`).click();
                    return;
                }
            }
            await this.locator.click();
        }
    }

    async check(): Promise<void> {
        await this.setChecked(true);
    }

    async uncheck(): Promise<void> {
        await this.setChecked(false);
    }
}

export class InputDriver extends ElementDriver {
    async fill(value: string, options?: {timeout?: number}): Promise<void> {
        await this.locator.fill(value, options);
    }

    async clear(options?: {timeout?: number}): Promise<void> {
        await this.locator.clear(options);
    }

    async value(options?: {timeout?: number}): Promise<string> {
        return this.locator.inputValue(options);
    }
}

export class FileInputDriver extends ElementDriver {
    async setInputFiles(files: string | string[]): Promise<void> {
        await this.locator.setInputFiles(files);
    }
}

export const elementDriver = (scope: Page | Locator, testId: string, role = 'container', attr: 'data-testid' | 'data-surface' = 'data-testid') => new ElementDriver(scope, testId, role, attr);
export const stateDriver = (scope: Page | Locator, testId: string, role: string, attr: 'data-testid' | 'data-surface' = 'data-testid') => new StateDriver(scope, testId, role, attr);
export const inputDriver = (scope: Page | Locator, testId: string, role: string, attr: 'data-testid' | 'data-surface' = 'data-testid') => new InputDriver(scope, testId, role, attr);
export const fileInputDriver = (scope: Page | Locator, testId: string, role = 'file', attr: 'data-testid' | 'data-surface' = 'data-testid') => new FileInputDriver(scope, testId, role, attr);
