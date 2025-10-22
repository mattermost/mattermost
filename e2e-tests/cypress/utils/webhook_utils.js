// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Helper function to create dialog base structure
function createDialog(triggerId, webhookBaseUrl, dialogConfig) {
    const baseDialog = {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: dialogConfig.callback_id,
            title: dialogConfig.title,
            submit_label: dialogConfig.submit_label || 'Submit',
            notify_on_cancel: true,
            ...dialogConfig.dialog_props,
            elements: dialogConfig.elements || [],
        },
    };

    if (dialogConfig.icon_url) {
        baseDialog.dialog.icon_url = dialogConfig.icon_url;
    }

    if (dialogConfig.introduction_text) {
        baseDialog.dialog.introduction_text = dialogConfig.introduction_text;
    }

    if (dialogConfig.state) {
        baseDialog.dialog.state = dialogConfig.state;
    }

    if (dialogConfig.source_url) {
        baseDialog.dialog.source_url = dialogConfig.source_url;
    }

    return baseDialog;
}

// Helper function to create form response structure
function createFormResponse(formConfig) {
    return {
        callback_id: formConfig.callback_id,
        title: formConfig.title,
        submit_label: formConfig.submit_label || 'Submit',
        notify_on_cancel: true,
        elements: formConfig.elements || [],
        ...formConfig.form_props,
    };
}

// Helper function to create common form elements
function createElement(type, config) {
    const baseElement = {
        display_name: config.display_name,
        name: config.name,
        type,
        optional: config.optional || false,
    };

    if (config.placeholder) {
        baseElement.placeholder = config.placeholder;
    }
    if (config.help_text) {
        baseElement.help_text = config.help_text;
    }
    if (config.default) {
        baseElement.default = config.default;
    }
    if (config.subtype) {
        baseElement.subtype = config.subtype;
    }
    if (config.min_length) {
        baseElement.min_length = config.min_length;
    }
    if (config.max_length) {
        baseElement.max_length = config.max_length;
    }
    if (config.data_source) {
        baseElement.data_source = config.data_source;
    }
    if (config.options) {
        baseElement.options = config.options;
    }
    if (config.refresh) {
        baseElement.refresh = config.refresh;
    }

    return baseElement;
}

// Standard icon URL
const STANDARD_ICON = 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png';

// Dialog configurations
const DIALOG_CONFIGS = {
    full: {
        callback_id: 'somecallbackid',
        title: 'Title for Full Dialog Test',
        icon_url: STANDARD_ICON,
        elements: [
            createElement('text', {display_name: 'Display Name', name: 'realname', default: 'default text', placeholder: 'placeholder', help_text: 'This a regular input in an interactive dialog triggered by a test integration.'}),
            createElement('text', {display_name: 'Email', name: 'someemail', subtype: 'email', placeholder: 'placeholder@bladekick.com', help_text: 'This a regular email input in an interactive dialog triggered by a test integration.'}),
            createElement('text', {display_name: 'Number', name: 'somenumber', subtype: 'number'}),
            createElement('text', {display_name: 'Password', name: 'somepassword', subtype: 'password', default: 'p@ssW0rd', placeholder: 'placeholder', help_text: 'This a password input in an interactive dialog triggered by a test integration.', optional: true}),
            createElement('textarea', {display_name: 'Display Name Long Text Area', name: 'realnametextarea', placeholder: 'placeholder', optional: true, min_length: 5, max_length: 100}),
            createElement('select', {display_name: 'User Selector', name: 'someuserselector', placeholder: 'Select a user...', data_source: 'users'}),
            createElement('select', {display_name: 'Channel Selector', name: 'somechannelselector', placeholder: 'Select a channel...', help_text: 'Choose a channel from the list.', data_source: 'channels', optional: true}),
            createElement('select', {display_name: 'Option Selector', name: 'someoptionselector', placeholder: 'Select an option...', options: [{text: 'Option1', value: 'opt1'}, {text: 'Option2', value: 'opt2'}, {text: 'Option3', value: 'opt3'}]}),
            createElement('radio', {display_name: 'Radio Option Selector', name: 'someradiooptions', help_text: '', options: [{text: 'Engineering', value: 'engineering'}, {text: 'Sales', value: 'sales'}]}),
            createElement('bool', {display_name: 'Boolean Selector', name: 'boolean_input', placeholder: 'Was this modal helpful?', default: 'True', optional: true, help_text: 'This is the help text'}),
        ],
        dialog_props: {state: 'somestate'},
    },

    simple: {
        callback_id: 'somecallbackid',
        title: 'Title for Dialog Test without elements',
        icon_url: STANDARD_ICON,
        submit_label: 'Submit Test',
        dialog_props: {state: 'somestate'},
    },

    userAndChannel: {
        callback_id: 'somecallbackid',
        title: 'Title for Dialog Test with user and channel element',
        icon_url: STANDARD_ICON,
        submit_label: 'Submit Test',
        elements: [
            createElement('select', {display_name: 'User Selector', name: 'someuserselector', placeholder: 'Select a user...', data_source: 'users'}),
            createElement('select', {display_name: 'Channel Selector', name: 'somechannelselector', placeholder: 'Select a channel...', help_text: 'Choose a channel from the list.', data_source: 'channels', optional: true}),
        ],
        dialog_props: {state: 'somestate'},
    },

    boolean: {
        callback_id: 'somecallbackid',
        title: 'Title for Dialog Test with boolean element',
        icon_url: STANDARD_ICON,
        submit_label: 'Submit Test',
        elements: [
            createElement('bool', {display_name: 'Boolean Selector', name: 'boolean_input', placeholder: 'Was this modal helpful?', default: 'True', optional: true, help_text: 'This is the help text'}),
        ],
        dialog_props: {state: 'somestate'},
    },

    fieldRefresh: {
        callback_id: 'field_refresh_callback',
        title: 'Field Refresh Demo',
        introduction_text: 'Enter project name then select type to see different fields',
        elements: [
            createElement('text', {display_name: 'Project Name', name: 'project_name', placeholder: 'Enter project name'}),
            createElement('select', {display_name: 'Project Type', name: 'project_type', refresh: true, placeholder: 'Select project type...', options: [{text: 'Web Application', value: 'web'}, {text: 'Mobile App', value: 'mobile'}, {text: 'API Service', value: 'api'}]}),
        ],
    },

    multistepStep1: {
        callback_id: 'multistep_callback',
        title: 'Step 1 - Personal Info',
        introduction_text: 'Multi-step registration - Step 1 of 3',
        submit_label: 'Next Step',
        elements: [
            createElement('text', {display_name: 'First Name', name: 'first_name', placeholder: 'Enter your first name'}),
            createElement('text', {display_name: 'Email', name: 'email', subtype: 'email', placeholder: 'Enter your email address'}),
        ],
        dialog_props: {state: 'step1'},
    },

    multistepStep2: {
        callback_id: 'multistep_callback',
        title: 'Step 2 - Work Info',
        introduction_text: 'Multi-step registration - Step 2 of 3',
        submit_label: 'Next Step',
        elements: [
            createElement('select', {display_name: 'Department', name: 'department', placeholder: 'Select department...', options: [{text: 'Engineering', value: 'engineering'}, {text: 'Marketing', value: 'marketing'}, {text: 'Sales', value: 'sales'}]}),
            createElement('radio', {display_name: 'Experience Level', name: 'experience_level', options: [{text: 'Junior', value: 'junior'}, {text: 'Mid-level', value: 'mid'}, {text: 'Senior', value: 'senior'}]}),
        ],
        form_props: {state: 'step2'},
    },

    multistepStep3: {
        callback_id: 'multistep_callback',
        title: 'Step 3 - Final Details',
        introduction_text: 'Multi-step registration - Step 3 of 3',
        submit_label: 'Complete Registration',
        elements: [
            createElement('textarea', {display_name: 'Comments', name: 'comments', placeholder: 'Any additional comments...', optional: true}),
            createElement('bool', {display_name: 'Terms & Conditions', name: 'terms_accepted'}),
        ],
        form_props: {state: 'step3'},
    },
};

// Public API functions
function getFullDialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, DIALOG_CONFIGS.full);
}

function getSimpleDialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, DIALOG_CONFIGS.simple);
}

function getUserAndChannelDialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, DIALOG_CONFIGS.userAndChannel);
}

function getBooleanDialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, DIALOG_CONFIGS.boolean);
}

function getFieldRefreshDialog(triggerId, webhookBaseUrl) {
    const config = {...DIALOG_CONFIGS.fieldRefresh};
    config.source_url = `${webhookBaseUrl}/field_refresh_source`;
    return createDialog(triggerId, webhookBaseUrl, config);
}

function getMultistepStep1Dialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, DIALOG_CONFIGS.multistepStep1);
}

function getMultistepStep2Dialog(triggerId, webhookBaseUrl) {
    const config = {...DIALOG_CONFIGS.multistepStep2};
    config.dialog_props = {url: `${webhookBaseUrl}/dialog_submit`, ...config.form_props};
    return createFormResponse(config);
}

function getMultistepStep3Dialog(triggerId, webhookBaseUrl) {
    const config = {...DIALOG_CONFIGS.multistepStep3};
    config.dialog_props = {url: `${webhookBaseUrl}/dialog_submit`, ...config.form_props};
    return createFormResponse(config);
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
    getFieldRefreshDialog,
    getMultistepStep1Dialog,
    getMultistepStep2Dialog,
    getMultistepStep3Dialog,
    getMultiSelectDialog,
    getDynamicSelectDialog,
    getDateTimeDialog,
    getBasicDateDialog,
    getBasicDateTimeDialog,
    getMinDateConstraintDialog,
    getCustomIntervalDialog,
    getRelativeDateDialog,
};
