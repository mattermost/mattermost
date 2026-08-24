// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RuleTester} from 'eslint';

import rule from './no-redundant-admin-config-deps.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
});

const filename = 'admin_definition.tsx';

ruleTester.run('no-redundant-admin-config-deps', rule, {
    valid: [
        {
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableEmailBatching',
                            isDisabled: it.any(
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                                it.configIsTrue('ClusterSettings', 'Enable'),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'EmailSettings.EmailBatchingBufferSize',
                            isDisabled: it.any(
                                it.stateIsFalse('EmailSettings.EnableEmailBatching'),
                            ),
                        },
                    ],
                };
            `,
        },
        {
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableOAuthServiceProvider',
                            isDisabled: it.not(it.userHasWritePermissionOnResource('integrations')),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableDynamicClientRegistration',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource('integrations')),
                                it.stateIsFalse('ServiceSettings.EnableOAuthServiceProvider'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.DCRRedirectURIAllowlist',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource('integrations')),
                                it.stateIsFalse('ServiceSettings.EnableDynamicClientRegistration'),
                            ),
                        },
                    ],
                };
            `,
        },
        {
            // Non-bool parents (fileupload) do not imply their isDisabled conditions,
            // so repeating Encrypt alongside PrivateKeyFile is intentional.
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'SamlSettings.Encrypt',
                            isDisabled: it.stateIsFalse('SamlSettings.Enable'),
                        },
                        {
                            type: 'fileupload',
                            key: 'SamlSettings.PrivateKeyFile',
                            isDisabled: it.stateIsFalse('SamlSettings.Encrypt'),
                        },
                        {
                            type: 'bool',
                            key: 'SamlSettings.SignRequest',
                            isDisabled: it.any(
                                it.stateIsFalse('SamlSettings.Encrypt'),
                                it.stateIsFalse('SamlSettings.PrivateKeyFile'),
                            ),
                        },
                    ],
                };
            `,
        },
        {
            // Non-admin_definition files are ignored
            filename: 'other_file.tsx',
            code: `
                const x = {
                    type: 'number',
                    key: 'EmailSettings.EmailBatchingBufferSize',
                    isDisabled: it.any(
                        it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                        it.stateIsFalse('EmailSettings.EnableEmailBatching'),
                    ),
                };
                const y = {
                    type: 'bool',
                    key: 'EmailSettings.EnableEmailBatching',
                    isDisabled: it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                };
            `,
        },
    ],
    invalid: [
        {
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableEmailBatching',
                            isDisabled: it.any(
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                                it.configIsTrue('ClusterSettings', 'Enable'),
                                it.configIsFalse('ServiceSettings', 'SiteURL'),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'EmailSettings.EmailBatchingBufferSize',
                            isDisabled: it.any(
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                                it.stateIsFalse('EmailSettings.EnableEmailBatching'),
                                it.configIsTrue('ClusterSettings', 'Enable'),
                                it.configIsFalse('ServiceSettings', 'SiteURL'),
                            ),
                        },
                    ],
                };
            `,
            errors: [
                {messageId: 'redundant', data: {condition: 'stateIsFalse:"EmailSettings.SendEmailNotifications"', setting: 'EmailSettings.EmailBatchingBufferSize', parent: 'EmailSettings.EnableEmailBatching'}},
                {messageId: 'redundant', data: {condition: 'configIsTrue:"ClusterSettings","Enable"', setting: 'EmailSettings.EmailBatchingBufferSize', parent: 'EmailSettings.EnableEmailBatching'}},
                {messageId: 'redundant', data: {condition: 'configIsFalse:"ServiceSettings","SiteURL"', setting: 'EmailSettings.EmailBatchingBufferSize', parent: 'EmailSettings.EnableEmailBatching'}},
            ],
        },
        {
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableOAuthServiceProvider',
                            isDisabled: it.not(it.userHasWritePermissionOnResource('integrations')),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableDynamicClientRegistration',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource('integrations')),
                                it.stateIsFalse('ServiceSettings.EnableOAuthServiceProvider'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.DCRRedirectURIAllowlist',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource('integrations')),
                                it.stateIsFalse('ServiceSettings.EnableOAuthServiceProvider'),
                                it.stateIsFalse('ServiceSettings.EnableDynamicClientRegistration'),
                            ),
                        },
                    ],
                };
            `,
            errors: [
                {messageId: 'redundant', data: {condition: 'stateIsFalse:"ServiceSettings.EnableOAuthServiceProvider"', setting: 'ServiceSettings.DCRRedirectURIAllowlist', parent: 'ServiceSettings.EnableDynamicClientRegistration'}},
            ],
        },
        {
            // Bool parent Encrypt implies Enable; PrivateKeyFile should not repeat Enable
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'SamlSettings.Encrypt',
                            isDisabled: it.stateIsFalse('SamlSettings.Enable'),
                        },
                        {
                            type: 'fileupload',
                            key: 'SamlSettings.PrivateKeyFile',
                            isDisabled: it.any(
                                it.stateIsFalse('SamlSettings.Enable'),
                                it.stateIsFalse('SamlSettings.Encrypt'),
                            ),
                        },
                    ],
                };
            `,
            errors: [
                {messageId: 'redundant', data: {condition: 'stateIsFalse:"SamlSettings.Enable"', setting: 'SamlSettings.PrivateKeyFile', parent: 'SamlSettings.Encrypt'}},
            ],
        },
        {
            // Grandparent listed before parent: still attribute to the closest parent (Mid),
            // not Root, after the full tree is built.
            filename,
            code: `
                const AdminDefinition = {
                    settings: [
                        {
                            type: 'bool',
                            key: 'FeatureSettings.Root',
                            isDisabled: it.configIsTrue('ClusterSettings', 'Enable'),
                        },
                        {
                            type: 'bool',
                            key: 'FeatureSettings.Mid',
                            isDisabled: it.any(
                                it.stateIsFalse('FeatureSettings.Root'),
                                it.configIsTrue('ClusterSettings', 'Enable'),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'FeatureSettings.Leaf',
                            isDisabled: it.any(
                                it.stateIsFalse('FeatureSettings.Root'),
                                it.stateIsFalse('FeatureSettings.Mid'),
                                it.configIsTrue('ClusterSettings', 'Enable'),
                            ),
                        },
                    ],
                };
            `,
            errors: [
                {messageId: 'redundant', data: {condition: 'configIsTrue:"ClusterSettings","Enable"', setting: 'FeatureSettings.Mid', parent: 'FeatureSettings.Root'}},
                {messageId: 'redundant', data: {condition: 'stateIsFalse:"FeatureSettings.Root"', setting: 'FeatureSettings.Leaf', parent: 'FeatureSettings.Mid'}},
                {messageId: 'redundant', data: {condition: 'configIsTrue:"ClusterSettings","Enable"', setting: 'FeatureSettings.Leaf', parent: 'FeatureSettings.Mid'}},
            ],
        },
    ],
});
