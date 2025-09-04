// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function getFullDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Full Dialog Test',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            elements: [
                {
                    display_name: 'Display Name',
                    name: 'realname',
                    type: 'text',
                    subtype: '',
                    default: 'default text',
                    placeholder: 'placeholder',
                    help_text:
                        'This a regular input in an interactive dialog triggered by a test integration.',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: null,
                },
                {
                    display_name: 'Email',
                    name: 'someemail',
                    type: 'text',
                    subtype: 'email',
                    default: '',
                    placeholder: 'placeholder@bladekick.com',
                    help_text:
                        'This a regular email input in an interactive dialog triggered by a test integration.',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: null,
                },
                {
                    display_name: 'Number',
                    name: 'somenumber',
                    type: 'text',
                    subtype: 'number',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: null,
                },
                {
                    display_name: 'Password',
                    name: 'somepassword',
                    type: 'text',
                    subtype: 'password',
                    default: 'p@ssW0rd',
                    placeholder: 'placeholder',
                    help_text:
                        'This a password input in an interactive dialog triggered by a test integration.',
                    optional: true,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: null,
                },
                {
                    display_name: 'Display Name Long Text Area',
                    name: 'realnametextarea',
                    type: 'textarea',
                    subtype: '',
                    default: '',
                    placeholder: 'placeholder',
                    help_text: '',
                    optional: true,
                    min_length: 5,
                    max_length: 100,
                    data_source: '',
                    options: null,
                },
                {
                    display_name: 'User Selector',
                    name: 'someuserselector',
                    type: 'select',
                    subtype: '',
                    default: '',
                    placeholder: 'Select a user...',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: 'users',
                    options: null,
                },
                {
                    display_name: 'Channel Selector',
                    name: 'somechannelselector',
                    type: 'select',
                    subtype: '',
                    default: '',
                    placeholder: 'Select a channel...',
                    help_text: 'Choose a channel from the list.',
                    optional: true,
                    min_length: 0,
                    max_length: 0,
                    data_source: 'channels',
                    options: null,
                },
                {
                    display_name: 'Option Selector',
                    name: 'someoptionselector',
                    type: 'select',
                    subtype: '',
                    default: '',
                    placeholder: 'Select an option...',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [
                        {
                            text: 'Option1',
                            value: 'opt1',
                        },
                        {
                            text: 'Option2',
                            value: 'opt2',
                        },
                        {
                            text: 'Option3',
                            value: 'opt3',
                        },
                    ],
                },
                {
                    display_name: 'Radio Option Selector',
                    name: 'someradiooptions',
                    type: 'radio',
                    help_text: '',
                    optional: false,
                    options: [
                        {
                            text: 'Engineering',
                            value: 'engineering',
                        },
                        {
                            text: 'Sales',
                            value: 'sales',
                        },
                    ],
                },
                {
                    display_name: 'Boolean Selector',
                    placeholder: 'Was this modal helpful?',
                    name: 'boolean_input',
                    type: 'bool',
                    default: 'True',
                    optional: true,
                    help_text: 'This is the help text',
                },
            ],
            submit_label: 'Submit',
            notify_on_cancel: true,
            state: 'somestate',
        },
    };
}

function getSimpleDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Dialog Test without elements',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            submit_label: 'Submit Test',
            notify_on_cancel: true,
            state: 'somestate',
        },
    };
}

function getUserAndChannelDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Dialog Test with user and channel element',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            submit_label: 'Submit Test',
            notify_on_cancel: true,
            state: 'somestate',
            elements: [
                {
                    display_name: 'User Selector',
                    name: 'someuserselector',
                    type: 'select',
                    subtype: '',
                    default: '',
                    placeholder: 'Select a user...',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: 'users',
                    options: null,
                },
                {
                    display_name: 'Channel Selector',
                    name: 'somechannelselector',
                    type: 'select',
                    subtype: '',
                    default: '',
                    placeholder: 'Select a channel...',
                    help_text: 'Choose a channel from the list.',
                    optional: true,
                    min_length: 0,
                    max_length: 0,
                    data_source: 'channels',
                    options: null,
                },
            ],
        },
    };
}

function getBooleanDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Dialog Test with boolean element',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            submit_label: 'Submit Test',
            notify_on_cancel: true,
            state: 'somestate',
            elements: [
                {
                    display_name: 'Boolean Selector',
                    placeholder: 'Was this modal helpful?',
                    name: 'boolean_input',
                    type: 'bool',
                    default: 'True',
                    optional: true,
                    help_text: 'This is the help text',
                },
            ],
        },
    };
}

function getMultiSelectDialog(triggerId, webhookBaseUrl, includeDefaults = false) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Dialog Test with multiselect elements',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            submit_label: 'Submit Multiselect Test',
            notify_on_cancel: true,
            state: 'somestate',
            elements: [
                {
                    display_name: 'Multi Option Selector',
                    name: 'multiselect_options',
                    type: 'select',
                    multiselect: true,
                    default: includeDefaults ? 'opt1,opt3' : '',
                    placeholder: 'Select multiple options...',
                    help_text: 'You can select multiple options from this list.',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [
                        {
                            text: 'Engineering',
                            value: 'opt1',
                        },
                        {
                            text: 'Sales',
                            value: 'opt2',
                        },
                        {
                            text: 'Marketing',
                            value: 'opt3',
                        },
                        {
                            text: 'Support',
                            value: 'opt4',
                        },
                        {
                            text: 'Product',
                            value: 'opt5',
                        },
                    ],
                },
                {
                    display_name: 'Multi User Selector',
                    name: 'multiselect_users',
                    type: 'select',
                    multiselect: true,
                    default: '',
                    placeholder: 'Select multiple users...',
                    help_text: 'Choose multiple users from the team.',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: 'users',
                    options: null,
                },
                {
                    display_name: 'Single Option Selector',
                    name: 'single_select_options',
                    type: 'select',
                    multiselect: false,
                    default: includeDefaults ? 'single2' : '',
                    placeholder: 'Select one option...',
                    help_text: 'This is a regular single-select for comparison.',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [
                        {
                            text: 'Single Option 1',
                            value: 'single1',
                        },
                        {
                            text: 'Single Option 2',
                            value: 'single2',
                        },
                        {
                            text: 'Single Option 3',
                            value: 'single3',
                        },
                    ],
                },
            ],
        },
    };
}

function getDynamicSelectDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Dialog Test with dynamic select element',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            submit_label: 'Submit Dynamic Select Test',
            notify_on_cancel: true,
            state: 'somestate',
            elements: [
                {
                    display_name: 'Dynamic Role Selector',
                    name: 'dynamic_role_selector',
                    type: 'select',
                    data_source: 'dynamic',
                    data_source_url: `${webhookBaseUrl}/dynamic_select_source`,
                    default: '',
                    placeholder: 'Search for a role...',
                    help_text: 'Start typing to search for available roles. Options are loaded dynamically.',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                },
                {
                    display_name: 'Optional Dynamic Selector',
                    name: 'optional_dynamic_selector',
                    type: 'select',
                    data_source: 'dynamic',
                    data_source_url: `${webhookBaseUrl}/dynamic_select_source`,
                    default: 'backend_eng',
                    placeholder: 'Search for another role...',
                    help_text: 'This field is optional and has a default value.',
                    optional: true,
                    min_length: 0,
                    max_length: 0,
                },
            ],
        },
    };
}

module.exports = {
    getFullDialog,
    getSimpleDialog,
    getUserAndChannelDialog,
    getBooleanDialog,
    getMultiSelectDialog,
    getDynamicSelectDialog,
};
