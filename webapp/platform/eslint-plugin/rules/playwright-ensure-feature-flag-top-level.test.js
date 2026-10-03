// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RuleTester} from 'eslint';

import rule from './playwright-ensure-feature-flag-top-level.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
});

const filename = 'some_spec.spec.ts';

ruleTester.run('playwright-ensure-feature-flag-top-level', rule, {
    valid: [
        {

            // pw.ensureFeatureFlag in a single top-level beforeAll.
            filename,
            code: `
                test.describe('suite', () => {
                    test.beforeAll(async ({pw}) => {
                        await pw.ensureFeatureFlag('ChannelAttributes', true);
                    });

                    test('does a thing', async ({pw}) => {
                        await doSomething();
                    });
                });
            `,
        },
        {

            // Bare ensureFeatureFlag import, combined-flags form, in beforeAll.
            filename,
            code: `
                test.describe('suite', () => {
                    test.beforeAll(async () => {
                        await ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
                    });

                    test('does a thing', async ({pw}) => {
                        await doSomething();
                    });
                });
            `,
        },
        {

            // No ensureFeatureFlag call at all is always fine.
            filename,
            code: `
                test('does a thing', async ({pw}) => {
                    await doSomething();
                });
            `,
        },
        {

            // Nested describe's beforeAll still counts as a top-level-enough beforeAll.
            filename,
            code: `
                test.describe('outer', () => {
                    test.describe('inner', () => {
                        test.beforeAll(async ({pw}) => {
                            await pw.ensureFeatureFlag('ChannelAttributes', true);
                        });

                        test('does a thing', async ({pw}) => {
                            await doSomething();
                        });
                    });
                });
            `,
        },
        {

            // Not a .spec.ts file: rule does not apply.
            filename: 'helpers.ts',
            code: `
                test('does a thing', async ({pw}) => {
                    await pw.ensureFeatureFlag('ChannelAttributes', true);
                });
            `,
        },
    ],
    invalid: [
        {

            // Called directly inside a test body.
            filename,
            code: `
                test('does a thing', async ({pw}) => {
                    await pw.ensureFeatureFlag('ChannelAttributes', true);
                    await doSomething();
                });
            `,
            errors: [{messageId: 'wrongLocation', data: {context: 'test.test()'}}],
        },
        {

            // Called inside beforeEach instead of beforeAll.
            filename,
            code: `
                test.describe('suite', () => {
                    test.beforeEach(async ({pw}) => {
                        await pw.ensureFeatureFlag('ChannelAttributes', true);
                    });

                    test('does a thing', async ({pw}) => {
                        await doSomething();
                    });
                });
            `,
            errors: [{messageId: 'wrongLocation', data: {context: 'test.beforeEach()'}}],
        },
        {

            // Called at module level, outside any hook.
            filename,
            code: `
                await pw.ensureFeatureFlag('ChannelAttributes', true);

                test('does a thing', async ({pw}) => {
                    await doSomething();
                });
            `,
            errors: [{messageId: 'wrongLocation', data: {context: 'module-level code'}}],
        },
        {

            // Two separate per-test calls with different values.
            filename,
            code: `
                test('on', async ({pw}) => {
                    await pw.ensureFeatureFlag('ChannelAttributes', true);
                });

                test('off', async ({pw}) => {
                    await pw.ensureFeatureFlag('ChannelAttributes', false);
                });
            `,
            errors: [
                {messageId: 'multipleCalls', data: {count: '2'}},
                {messageId: 'multipleCalls', data: {count: '2'}},
            ],
        },
        {

            // Two calls even when both are in beforeAll hooks (e.g. a nested describe adding a
            // second one) is still disallowed - one call per file, not one per hook.
            filename,
            code: `
                test.describe('suite', () => {
                    test.beforeAll(async ({pw}) => {
                        await pw.ensureFeatureFlag('ChannelAttributes', true);
                    });

                    test.describe('nested', () => {
                        test.beforeAll(async ({pw}) => {
                            await pw.ensureFeatureFlag('ChannelAttributesRequired', true);
                        });

                        test('does a thing', async ({pw}) => {
                            await doSomething();
                        });
                    });
                });
            `,
            errors: [
                {messageId: 'multipleCalls', data: {count: '2'}},
                {messageId: 'multipleCalls', data: {count: '2'}},
            ],
        },
    ],
});
