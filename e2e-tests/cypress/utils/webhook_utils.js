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

// Basic date field test - MM-T2530A
function getBasicDateDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/datetime_dialog_submit`,
        dialog: {
            callback_id: 'basic_date_callback',
            title: 'DateTime Fields Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            elements: [
                {
                    display_name: 'Event Date',
                    name: 'event_date',
                    type: 'date',
                    default: '',
                    placeholder: 'Select a date',
                    help_text: 'Select the date for your event',
                    optional: false,
                },
            ],
            submit_label: 'Submit',
            notify_on_cancel: true,
            state: 'datetime_state',
        },
    };
}

// Basic datetime field test - MM-T2530B
function getBasicDateTimeDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/datetime_dialog_submit`,
        dialog: {
            callback_id: 'basic_datetime_callback',
            title: 'DateTime Fields Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            elements: [
                {
                    display_name: 'Event Date',
                    name: 'event_date',
                    type: 'date',
                    default: '',
                    placeholder: 'Select a date',
                    help_text: 'Select the date for your event',
                    optional: false,
                },
                {
                    display_name: 'Meeting Time',
                    name: 'meeting_time',
                    type: 'datetime',
                    default: '',
                    placeholder: 'Select date and time',
                    help_text: 'Select the date and time for your meeting',
                    optional: false,
                    time_interval: 60,
                },
            ],
            submit_label: 'Submit',
            notify_on_cancel: true,
            state: 'datetime_state',
        },
    };
}

// Date field with min_date constraint - MM-T2530C
function getMinDateConstraintDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/datetime_dialog_submit`,
        dialog: {
            callback_id: 'mindate_callback',
            title: 'DateTime Fields Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            elements: [
                {
                    display_name: 'Future Date Only',
                    name: 'future_date',
                    type: 'date',
                    default: '',
                    placeholder: 'Select a future date',
                    help_text: 'Must be today or later',
                    optional: true,
                    min_date: 'today',
                },
            ],
            submit_label: 'Submit',
            notify_on_cancel: true,
            state: 'datetime_state',
        },
    };
}

// DateTime field with custom time interval - MM-T2530D
function getCustomIntervalDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/datetime_dialog_submit`,
        dialog: {
            callback_id: 'interval_callback',
            title: 'DateTime Fields Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            elements: [
                {
                    display_name: 'Custom Interval Time',
                    name: 'interval_time',
                    type: 'datetime',
                    default: '',
                    placeholder: 'Select time (30min intervals)',
                    help_text: 'Time picker with 30-minute intervals',
                    optional: true,
                    time_interval: 30,
                },
            ],
            submit_label: 'Submit',
            notify_on_cancel: true,
            state: 'datetime_state',
        },
    };
}

// Relative date values test - MM-T2530F
function getRelativeDateDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/datetime_dialog_submit`,
        dialog: {
            callback_id: 'relative_callback',
            title: 'DateTime Fields Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            elements: [
                {
                    display_name: 'Relative Date Example',
                    name: 'relative_date',
                    type: 'date',
                    default: 'today',
                    placeholder: 'Today by default',
                    help_text: 'Defaults to today using relative date',
                    optional: true,
                },
                {
                    display_name: 'Relative DateTime Example',
                    name: 'relative_datetime',
                    type: 'datetime',
                    default: '+1d',
                    placeholder: 'Tomorrow by default',
                    help_text: 'Defaults to tomorrow using relative date',
                    optional: true,
                },
            ],
            submit_label: 'Submit',
            notify_on_cancel: true,
            state: 'datetime_state',
        },
    };
}

// Legacy function for backward compatibility - returns basic datetime dialog
function getDateTimeDialog(triggerId, webhookBaseUrl) {
    return getBasicDateTimeDialog(triggerId, webhookBaseUrl);
}

module.exports = {
    getFullDialog,
    getSimpleDialog,
    getUserAndChannelDialog,
    getBooleanDialog,
    getMultiSelectDialog,
    getDateTimeDialog,
    getBasicDateDialog,
    getBasicDateTimeDialog,
    getMinDateConstraintDialog,
    getCustomIntervalDialog,
    getRelativeDateDialog,
};
