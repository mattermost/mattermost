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
    if (config.action_button) {
        baseElement.action_button = config.action_button;
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

    // Integration returns SubmitDialogResponse.errors (no top-level error string).
    serverFieldErrors: {
        callback_id: 'server_field_errors_callback',
        title: 'Server Field Errors Dialog',
        icon_url: STANDARD_ICON,
        submit_label: 'Submit',
        elements: [
            createElement('text', {
                display_name: 'Name',
                name: 'realname',
                default: 'Ada',
                optional: true,
                placeholder: 'Enter name',
            }),
            createElement('text', {
                display_name: 'Email',
                name: 'someemail',
                subtype: 'email',
                default: 'ada@example.com',
                optional: true,
                placeholder: 'Enter email',
            }),
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

    actionButtonParent: {
        callback_id: 'action_button_parent_callback',
        title: 'Parent Dialog with Action Button',
        elements: [],
    },

    actionButtonChild: {
        callback_id: 'child_callback',
        title: 'Child Dialog',
        elements: [
            createElement('text', {display_name: 'Child Input', name: 'child_input', placeholder: 'Enter value', optional: true}),
        ],
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

function getServerFieldErrorsDialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, DIALOG_CONFIGS.serverFieldErrors);
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

function getTimezoneManualDialog(triggerId, webhookBaseUrl) {
    return createDialog(triggerId, webhookBaseUrl, {
        callback_id: 'timezone_manual',
        title: 'Timezone & Manual Entry Demo',
        introduction_text: '**Timezone & Manual Entry Demo**\n\n' +
            'This dialog demonstrates timezone support and manual time entry features.',
        elements: [
            {
                display_name: 'Your Local Time (Manual Entry)',
                name: 'local_manual',
                type: 'datetime',
                help_text: 'Type any time: 9am, 14:30, 3:45pm - no rounding',
                datetime_config: {
                    manual_time_entry: true,
                },
                optional: true,
            },
            {
                display_name: 'London Office Hours (Dropdown)',
                name: 'london_dropdown',
                type: 'datetime',
                help_text: 'Times shown in GMT - select from 60 min intervals',
                datetime_config: {
                    location_timezone: 'Europe/London',
                    time_interval: 60,
                },
                optional: true,
            },
            {
                display_name: 'London Office Hours (Manual Entry)',
                name: 'london_manual',
                type: 'datetime',
                help_text: 'Type time in GMT: 9am, 14:30, 3:45pm - no rounding',
                datetime_config: {
                    location_timezone: 'Europe/London',
                    manual_time_entry: true,
                },
                optional: true,
            },
        ],
    });
}

function getFileUploadDialog(triggerId, webhookBaseUrl) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog_submit`,
        dialog: {
            callback_id: 'somecallbackid',
            title: 'Title for Dialog Test with file upload element',
            icon_url:
                'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            submit_label: 'Submit File Upload Test',
            notify_on_cancel: true,
            state: 'somestate',
            elements: [
                {
                    display_name: 'Upload Single Document',
                    name: 'single_document',
                    type: 'file',
                    placeholder: 'Select one document...',
                    help_text: 'Upload a single document (replaces previous selection).',
                    optional: false,
                },
                {
                    display_name: 'Upload Multiple Files',
                    name: 'multiple_files',
                    type: 'file',
                    allow_multiple: true,
                    placeholder: 'Select multiple files...',
                    help_text: 'Upload multiple files (can select and add more).',
                    optional: false,
                },
                {
                    display_name: 'Description',
                    name: 'description',
                    type: 'textarea',
                    subtype: '',
                    default: '',
                    placeholder: 'Describe the uploaded files...',
                    help_text: 'Provide a description for the uploaded files.',
                    optional: true,
                    min_length: 0,
                    max_length: 500,
                    data_source: '',
                    options: null,
                },
            ],
        },
    };
}

function getActionButtonParentDialog(triggerId, webhookBaseUrl) {
    const config = {
        ...DIALOG_CONFIGS.actionButtonParent,
        elements: [
            createElement('text', {display_name: 'Your Name', name: 'your_name', placeholder: 'Enter your name', optional: true}),

            // Two action buttons on the same dialog. Each carries a distinct
            // context.source so the child dialog can reflect which one was pressed.
            createElement('action_button', {
                display_name: 'Open Details',
                name: 'open_details',
                action_button: {
                    url: `${webhookBaseUrl}/dialog/open_child`,
                    context: {source: 'Details'},
                },
            }),
            createElement('action_button', {
                display_name: 'Open Summary',
                name: 'open_summary',
                action_button: {
                    url: `${webhookBaseUrl}/dialog/open_child`,
                    context: {source: 'Summary'},
                },
            }),
        ],
    };
    return createDialog(triggerId, webhookBaseUrl, config);
}

// `source` comes from the pressed action button's context.source and is reflected
// in the child dialog's title and introduction text, so a test can verify which
// button opened it.
function getActionButtonChildDialog(triggerId, webhookBaseUrl, source) {
    const label = source || 'Unknown';
    const config = {
        ...DIALOG_CONFIGS.actionButtonChild,
        title: `${label} Dialog`,
        introduction_text: `This child dialog was opened from the "${label}" action button.`,
    };
    return createDialog(triggerId, webhookBaseUrl, config);
}

/**
 * OpenDialogRequest for mm_blocks (blocks-mode) interactive dialogs.
 * Actions URLs point at Playwright webhook endpoints under webhookBaseUrl.
 */
function getMmBlocksDialog(triggerId, webhookBaseUrl, options = {}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    // Dialog titles are capped at DialogTitleMaxLength (24).
    const title = options.title || 'PW Blocks Dialog';
    const marker = options.marker || '';

    return {
        trigger_id: triggerId,
        block_dialog: {
            title,
            state: options.state || 'pw-mm-blocks-dialog',
            submit: {action: 'pw_dialog_submit', label: options.submitLabel || 'Submit'},
            cancel: {action: 'pw_dialog_cancel', label: options.cancelLabel || 'Cancel'},
            blocks: [
                {
                    type: 'text',
                    text: marker ?
                        `Blocks dialog for **${marker}**. Fill fields, then Submit / Next step / Show errors.` :
                        'Blocks dialog — fill fields, then Submit / Next step / Show errors.',
                },
                {type: 'divider'},
                {
                    type: 'text_input',
                    name: 'title',
                    label: 'Title',
                    placeholder: 'Short title',
                    help_text: 'Required for a successful submit.',
                    initial_value: 'Demo ticket',
                    max_length: 80,
                },
                {
                    type: 'text_input',
                    name: 'email',
                    label: 'Email',
                    subtype: 'email',
                    placeholder: 'you@example.com',
                    optional: true,
                },
                {
                    type: 'text_input',
                    name: 'description',
                    label: 'Description',
                    multiline: true,
                    placeholder: 'Longer text…',
                    optional: true,
                    max_length: 500,
                },
                {
                    type: 'bool_input',
                    name: 'enabled',
                    label: 'Enabled',
                    placeholder: 'Turn this on',
                    initial_value: true,
                },
                {
                    type: 'select',
                    name: 'priority',
                    label: 'Priority',
                    placeholder: 'Choose priority',
                    options: [
                        {text: 'Low', value: 'low'},
                        {text: 'Medium', value: 'medium'},
                        {text: 'High', value: 'high'},
                    ],
                    initial_option: 'medium',
                },
                {
                    type: 'select',
                    name: 'severity',
                    label: 'Severity',
                    style: 'expanded',
                    options: [
                        {text: 'SEV-1', value: 'sev1'},
                        {text: 'SEV-2', value: 'sev2'},
                    ],
                    initial_option: 'sev2',
                },
                {
                    type: 'select',
                    name: 'pick',
                    label: 'Dynamic option',
                    placeholder: 'Type to search…',
                    data_source: 'dynamic',
                    data_source_action: 'pw_dialog_lookup',
                    optional: true,
                    help_text: 'Options from lookup integration.',
                },
                {
                    type: 'date_input',
                    name: 'due_date',
                    label: 'Due date',
                    optional: true,
                    placeholder: 'Pick a due date',
                    initial_value: '2025-01-10',
                },
                {
                    type: 'datetime_input',
                    name: 'meeting_at',
                    label: 'Meeting time',
                    optional: true,
                },
                {
                    type: 'file_input',
                    name: 'attachments',
                    label: 'Attachments',
                    optional: true,
                    placeholder: 'Upload evidence',
                    help_text: 'Optional file upload.',
                },
                {type: 'divider'},
                {
                    type: 'container',
                    flow: 'horizontal',
                    gap: 'medium',
                    content: [
                        {
                            type: 'button',
                            text: 'Next step',
                            style: 'default',
                            subtype: 'submit',
                            action_id: 'pw_dialog_refresh',
                        },
                        {
                            type: 'button',
                            text: 'Show errors',
                            style: 'danger',
                            subtype: 'submit',
                            action_id: 'pw_dialog_errors',
                        },
                        {
                            type: 'button',
                            text: 'Top-level error',
                            style: 'danger',
                            action_id: 'pw_dialog_error',
                        },
                        {
                            type: 'button',
                            text: 'Navigate away',
                            style: 'default',
                            action_id: 'pw_dialog_goto',
                        },
                    ],
                },
            ],
            actions: mmBlocksDialogActions(base, {
                pw_dialog_refresh: {type: 'external', url: `${base}/mm_blocks_dialog_refresh`, context: {scenario: 'refresh'}},
                pw_dialog_errors: {type: 'external', url: `${base}/mm_blocks_dialog_errors`, context: {}},
                pw_dialog_error: {type: 'external', url: `${base}/mm_blocks_dialog_error`, context: {}},
                pw_dialog_goto: {type: 'external', url: `${base}/mm_blocks_dialog_goto`, context: {}},
                pw_dialog_lookup: {type: 'external', url: `${base}/mm_blocks_integration_lookup`, context: {}},
            }),
        },
    };
}

/** Base submit/cancel actions; pass extras only for action ids referenced by blocks. */
function mmBlocksDialogActions(base, extras = {}) {
    return {
        pw_dialog_submit: {type: 'external', url: `${base}/mm_blocks_dialog_submit`, context: {form: 'blocks_dialog'}},
        pw_dialog_cancel: {type: 'external', url: `${base}/mm_blocks_dialog_cancel`, context: {reason: 'cancel'}},
        ...extras,
    };
}

function mmBlocksAction(base, path, context = {}) {
    return {type: 'external', url: `${base}${path}`, context};
}

function baseBlockDialog(webhookBaseUrl, {title, state, submitLabel, cancelLabel, blocks, actionsExtras}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    return {
        title: title || 'PW Blocks Dialog',
        state: state || 'pw-mm-blocks-dialog',
        submit: {action: 'pw_dialog_submit', label: submitLabel || 'Submit'},
        cancel: {action: 'pw_dialog_cancel', label: cancelLabel || 'Cancel'},
        blocks,
        actions: mmBlocksDialogActions(base, actionsExtras),
    };
}

/** In-place refresh block_dialog body (returned as type:refresh). */
function getMmBlocksDialogStep2(webhookBaseUrl, previousTitle) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    const title = previousTitle || 'Step 2';

    return {
        // Keep modal title ≤ DialogTitleMaxLength (24); longer context goes in body text.
        title: 'Step 2',
        state: 'pw-mm-blocks-dialog-step-2',
        submit: {action: 'pw_dialog_submit', label: 'Finish'},
        cancel: {action: 'pw_dialog_cancel', label: 'Cancel'},
        blocks: [
            {
                type: 'text',
                text: `**Step 2** — refreshed from dialog. Previous title: \`${title}\``,
            },
            {
                type: 'text_input',
                name: 'notes',
                label: 'Follow-up notes',
                multiline: true,
                placeholder: 'Anything else?',
            },
            {
                type: 'bool_input',
                name: 'confirm',
                label: 'Confirm',
                placeholder: 'I confirm this step',
                initial_value: false,
            },
        ],
        actions: {
            pw_dialog_submit: {type: 'external', url: `${base}/mm_blocks_dialog_submit`, context: {step: '2'}},
            pw_dialog_cancel: {type: 'external', url: `${base}/mm_blocks_dialog_cancel`, context: {reason: 'cancel', step: '2'}},
        },
    };
}

function getMmBlocksSimpleDialog(webhookBaseUrl, options = {}) {
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Simple Dialog',
        state: 'pw-simple',
        blocks: [
            {
                type: 'text',
                text: options.marker ?
                    `Simple blocks dialog for **${options.marker}**.` :
                    'Simple blocks dialog with no form fields.',
            },
        ],
    });
}

function getMmBlocksFullDialog(webhookBaseUrl, options = {}) {
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Full Dialog',
        state: 'pw-full',
        blocks: [
            {type: 'text', text: options.marker ? `Full dialog **${options.marker}**` : 'Full field mix.'},
            {
                type: 'text_input',
                name: 'realname',
                label: 'Name',
                placeholder: 'Enter your name',
                help_text: 'Your full name.',
            },
            {
                type: 'text_input',
                name: 'someemail',
                label: 'Email',
                subtype: 'email',
                placeholder: 'you@example.com',
                optional: true,
            },
            {
                type: 'text_input',
                name: 'somenumber',
                label: 'Number',
                subtype: 'number',
                placeholder: 'Enter a number',
                optional: true,
            },
            {
                type: 'text_input',
                name: 'somepassword',
                label: 'Password',
                subtype: 'password',
                placeholder: 'Enter password',
                optional: true,
            },
            {
                type: 'text_input',
                name: 'realnametextarea',
                label: 'Notes',
                multiline: true,
                placeholder: 'Longer text…',
                optional: true,
            },
            {
                type: 'select',
                name: 'someuserselector',
                label: 'User',
                data_source: 'users',
                placeholder: 'Select a user…',
                optional: true,
            },
            {
                type: 'select',
                name: 'somechannelselector',
                label: 'Channel',
                data_source: 'channels',
                placeholder: 'Select a channel…',
                optional: true,
            },
            {
                type: 'select',
                name: 'someoptionselector',
                label: 'Option',
                placeholder: 'Select an option…',
                options: [
                    {text: 'Option1', value: 'opt1'},
                    {text: 'Option2', value: 'opt2'},
                    {text: 'Option3', value: 'opt3'},
                ],
                optional: true,
            },
            {
                type: 'select',
                name: 'someradiooptions',
                label: 'Radio Option',
                style: 'expanded',
                options: [
                    {text: 'Engineering', value: 'engineering'},
                    {text: 'Sales', value: 'sales'},
                ],
                optional: true,
            },
            {
                type: 'bool_input',
                name: 'boolean_input',
                label: 'Boolean Selector',
                placeholder: 'Was this modal helpful?',
                help_text: 'This is the help text',
                initial_value: true,
                optional: true,
            },
        ],
    });
}

function getMmBlocksBooleanDialog(webhookBaseUrl, options = {}) {
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Boolean Dialog',
        state: 'pw-boolean',
        blocks: [
            {
                type: 'bool_input',
                name: 'boolean_input',
                label: 'Boolean Selector',
                placeholder: 'Was this modal helpful?',
                help_text: 'This is the help text',
                initial_value: true,
                optional: true,
            },
        ],
    });
}

function getMmBlocksUsersChannelsDialog(webhookBaseUrl, options = {}) {
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Users Channels',
        state: 'pw-users-channels',
        blocks: [
            {
                type: 'select',
                name: 'someuserselector',
                label: 'User Selector',
                data_source: 'users',
                placeholder: 'Select a user…',
            },
            {
                type: 'select',
                name: 'somechannelselector',
                label: 'Channel Selector',
                data_source: 'channels',
                placeholder: 'Select a channel…',
                help_text: 'Choose a channel from the list.',
                optional: true,
            },
        ],
    });
}

function getMmBlocksMultiselectDialog(webhookBaseUrl, options = {}) {
    const includeDefaults = Boolean(options.includeDefaults);
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Multiselect',
        state: 'pw-multiselect',
        blocks: [
            {
                type: 'select',
                name: 'multiselect_options',
                label: 'Multi Option Selector',
                multiselect: true,
                placeholder: 'Select multiple options…',
                help_text: 'You can select multiple options from this list.',
                initial_options: includeDefaults ? ['opt1', 'opt3'] : undefined,
                options: [
                    {text: 'Engineering', value: 'opt1'},
                    {text: 'Sales', value: 'opt2'},
                    {text: 'Marketing', value: 'opt3'},
                    {text: 'Support', value: 'opt4'},
                    {text: 'Product', value: 'opt5'},
                ],
            },
            {
                type: 'select',
                name: 'multiselect_users',
                label: 'Multi User Selector',
                multiselect: true,
                data_source: 'users',
                placeholder: 'Select multiple users…',
                help_text: 'Choose multiple users from the team.',
            },
            {
                type: 'select',
                name: 'single_select_options',
                label: 'Single Option Selector',
                placeholder: 'Select one option…',
                options: [
                    {text: 'Engineering', value: 'opt1'},
                    {text: 'Sales', value: 'opt2'},
                    {text: 'Marketing', value: 'opt3'},
                ],
                optional: true,
            },
        ],
    });
}

function getMmBlocksDynamicDialog(webhookBaseUrl, options = {}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Dynamic Select',
        state: 'pw-dynamic',
        blocks: [
            {
                type: 'select',
                name: 'dynamic_role_selector',
                label: 'Role',
                placeholder: 'Type to search roles…',
                data_source: 'dynamic',
                data_source_action: 'pw_dialog_lookup',
                help_text: 'Required dynamic select.',
            },
            {
                type: 'select',
                name: 'optional_dynamic_selector',
                label: 'Optional Role',
                placeholder: 'Optional search…',
                data_source: 'dynamic',
                data_source_action: 'pw_dialog_lookup',
                optional: true,
                initial_option: 'opt_beta',
                help_text: 'Optional dynamic select with default.',
            },
        ],
        actionsExtras: {
            pw_dialog_lookup: mmBlocksAction(base, '/mm_blocks_integration_lookup'),
        },
    });
}

function getMmBlocksEmptyRequiredDialog(webhookBaseUrl, options = {}) {
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Required Fields',
        state: 'pw-required',
        blocks: [
            {
                type: 'text_input',
                name: 'realname',
                label: 'Name',
                placeholder: 'Enter your name',
            },
            {
                type: 'text_input',
                name: 'someemail',
                label: 'Email',
                subtype: 'email',
                placeholder: 'you@example.com',
            },
            {
                type: 'text_input',
                name: 'somenumber',
                label: 'Number',
                subtype: 'number',
                placeholder: 'Enter a number',
            },
            {
                type: 'text_input',
                name: 'somepassword',
                label: 'Password',
                subtype: 'password',
                placeholder: 'Enter password',
                optional: true,
            },
            {
                type: 'bool_input',
                name: 'boolean_input',
                label: 'Boolean Selector',
                placeholder: 'Was this modal helpful?',
                help_text: 'This is the help text',
                initial_value: true,
                optional: true,
            },
        ],
    });
}

function getMmBlocksFileUploadDialog(webhookBaseUrl, options = {}) {
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW File Upload',
        state: 'pw-file-upload',
        submitLabel: 'Submit Files',
        blocks: [
            {
                type: 'file_input',
                name: 'single_document',
                label: 'Upload Single Document',
                placeholder: 'Select one document…',
                help_text: 'Upload a single document (replaces previous selection).',
            },
            {
                type: 'file_input',
                name: 'multiple_files',
                label: 'Upload Multiple Files',
                allow_multiple: true,
                placeholder: 'Select multiple files…',
                help_text: 'Upload multiple files (can select and add more).',
            },
            {
                type: 'text_input',
                name: 'description',
                label: 'Description',
                multiline: true,
                placeholder: 'Describe the uploaded files…',
                optional: true,
                max_length: 500,
            },
        ],
    });
}

function getMmBlocksFieldRefreshDialog(webhookBaseUrl, options = {}) {
    const projectName = options.projectName || '';
    const projectType = options.projectType || '';
    const blocks = [
        {type: 'text', text: 'Enter project name then select type to see different fields'},
        {
            type: 'text_input',
            name: 'project_name',
            label: 'Project Name',
            placeholder: 'Enter project name',
            initial_value: projectName || undefined,
        },
        {
            type: 'select',
            name: 'project_type',
            label: 'Project Type',
            placeholder: 'Select project type…',
            onChange: 'pw_dialog_field_refresh',
            initial_option: projectType || undefined,
            options: [
                {text: 'Web Application', value: 'web'},
                {text: 'Mobile App', value: 'mobile'},
                {text: 'API Service', value: 'api'},
            ],
        },
    ];

    if (projectType === 'web') {
        blocks.push({
            type: 'select',
            name: 'framework',
            label: 'Framework',
            placeholder: 'Select framework…',
            options: [
                {text: 'React', value: 'react'},
                {text: 'Vue', value: 'vue'},
                {text: 'Angular', value: 'angular'},
            ],
            optional: true,
        });
    } else if (projectType === 'mobile') {
        blocks.push({
            type: 'select',
            name: 'platform',
            label: 'Platform',
            placeholder: 'Select platform…',
            options: [
                {text: 'iOS', value: 'ios'},
                {text: 'Android', value: 'android'},
                {text: 'React Native', value: 'react-native'},
            ],
            optional: true,
        });
    } else if (projectType === 'api') {
        blocks.push({
            type: 'select',
            name: 'language',
            label: 'Language',
            placeholder: 'Select language…',
            options: [
                {text: 'Go', value: 'go'},
                {text: 'Node.js', value: 'nodejs'},
                {text: 'Python', value: 'python'},
            ],
            optional: true,
        });
    }

    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'Field Refresh Demo',
        state: 'pw-field-refresh',
        blocks,
        actionsExtras: {
            pw_dialog_field_refresh: mmBlocksAction(
                String(webhookBaseUrl || '').replace(/\/$/, ''),
                '/mm_blocks_dialog_field_refresh',
            ),
        },
    });
}

function getMmBlocksMultistep1Dialog(webhookBaseUrl, options = {}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'Step 1 - Personal Info',
        state: 'step1',
        submitLabel: 'Next Step',
        blocks: [
            {type: 'text', text: 'Multi-step registration - Step 1 of 3'},
            {
                type: 'text_input',
                name: 'first_name',
                label: 'First Name',
                placeholder: 'Enter your first name',
            },
            {
                type: 'text_input',
                name: 'email',
                label: 'Email',
                subtype: 'email',
                placeholder: 'Enter your email address',
            },
        ],
        actionsExtras: {
            pw_dialog_submit: {
                type: 'external',
                url: `${base}/mm_blocks_dialog_multistep`,
                context: {step: '1'},
            },
        },
    });
}

function getMmBlocksMultistep2Dialog(webhookBaseUrl, options = {}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'Step 2 - Work Info',
        state: 'step2',
        submitLabel: 'Next Step',
        blocks: [
            {type: 'text', text: 'Multi-step registration - Step 2 of 3'},
            {
                type: 'select',
                name: 'department',
                label: 'Department',
                placeholder: 'Select department…',
                options: [
                    {text: 'Engineering', value: 'engineering'},
                    {text: 'Marketing', value: 'marketing'},
                    {text: 'Sales', value: 'sales'},
                ],
            },
            {
                type: 'select',
                name: 'experience_level',
                label: 'Experience Level',
                style: 'expanded',
                options: [
                    {text: 'Junior', value: 'junior'},
                    {text: 'Mid-level', value: 'mid'},
                    {text: 'Senior', value: 'senior'},
                ],
            },
        ],
        actionsExtras: {
            pw_dialog_submit: {
                type: 'external',
                url: `${base}/mm_blocks_dialog_multistep`,
                context: {step: '2'},
            },
        },
    });
}

function getMmBlocksMultistep3Dialog(webhookBaseUrl, options = {}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'Step 3 - Final Details',
        state: 'step3',
        submitLabel: 'Complete Registration',
        blocks: [
            {type: 'text', text: 'Multi-step registration - Step 3 of 3'},
            {
                type: 'text_input',
                name: 'comments',
                label: 'Comments',
                multiline: true,
                placeholder: 'Any additional comments…',
                optional: true,
            },
            {
                type: 'bool_input',
                name: 'terms_accepted',
                label: 'Terms & Conditions',
                placeholder: 'I accept the terms',
            },
        ],
        actionsExtras: {
            pw_dialog_submit: {
                type: 'external',
                url: `${base}/mm_blocks_dialog_submit`,
                context: {step: '3', form: 'multistep'},
            },
        },
    });
}

function getMmBlocksChildContentDialog(webhookBaseUrl, source) {
    const label = source || 'Unknown';
    // Title max 24: "Details Dialog" / "Summary Dialog"
    return baseBlockDialog(webhookBaseUrl, {
        title: `${label} Dialog`.slice(0, 24),
        state: `pw-child-${label}`,
        blocks: [
            {
                type: 'text',
                text: `This view was opened from the **${label}** button (stacked modal via dialogs/open).`,
            },
            {
                type: 'text_input',
                name: 'child_input',
                label: 'Child Input',
                placeholder: 'Enter value',
                optional: true,
            },
        ],
    });
}

/** OpenDialogRequest wrapper so a child block_dialog can be stacked on a parent. */
function getMmBlocksChildOpenRequest(triggerId, webhookBaseUrl, source) {
    return {
        trigger_id: triggerId,
        block_dialog: getMmBlocksChildContentDialog(webhookBaseUrl, source),
    };
}

function getMmBlocksActionParentDialog(webhookBaseUrl, options = {}) {
    const base = String(webhookBaseUrl || '').replace(/\/$/, '');
    return baseBlockDialog(webhookBaseUrl, {
        title: options.title || 'PW Action Buttons',
        state: 'pw-action-parent',
        blocks: [
            {
                type: 'text_input',
                name: 'your_name',
                label: 'Your Name',
                placeholder: 'Enter your name',
                optional: true,
            },
            {
                type: 'container',
                flow: 'horizontal',
                gap: 'medium',
                content: [
                    {
                        type: 'button',
                        text: 'Open Details',
                        style: 'primary',
                        action_id: 'pw_dialog_open_details',
                    },
                    {
                        type: 'button',
                        text: 'Open Summary',
                        style: 'default',
                        action_id: 'pw_dialog_open_summary',
                    },
                ],
            },
        ],
        actionsExtras: {
            pw_dialog_open_details: mmBlocksAction(base, '/mm_blocks_dialog_child', {source: 'Details'}),
            pw_dialog_open_summary: mmBlocksAction(base, '/mm_blocks_dialog_child', {source: 'Summary'}),
        },
    });
}

function getMmBlocksDatetimeDialog(webhookBaseUrl, scenario, options = {}) {
    const title = options.title || 'PW DateTime';
    let blocks = [];

    switch (scenario) {
    case 'datetime_basic':
        blocks = [
            {
                type: 'date_input',
                name: 'event_date',
                label: 'Event Date',
                placeholder: 'Select a date',
                help_text: 'Select the date for your event',
            },
            {
                type: 'datetime_input',
                name: 'meeting_time',
                label: 'Meeting Time',
                placeholder: 'Select date and time',
                help_text: 'Select the date and time for your meeting',
                optional: true,
                datetime_config: {time_interval: 60},
            },
        ];
        break;
    case 'datetime_mindate':
        blocks = [
            {
                type: 'date_input',
                name: 'future_date',
                label: 'Future Date Only',
                placeholder: 'Select a future date',
                help_text: 'Must be today or later',
                optional: true,
                datetime_config: {min_date: 'today'},
            },
        ];
        break;
    case 'datetime_interval':
        blocks = [
            {
                type: 'datetime_input',
                name: 'interval_time',
                label: 'Custom Interval Time',
                placeholder: 'Select time (30min intervals)',
                help_text: 'Time picker with 30-minute intervals',
                optional: true,
                datetime_config: {time_interval: 30},
            },
        ];
        break;
    case 'datetime_relative':
        blocks = [
            {
                type: 'date_input',
                name: 'relative_date',
                label: 'Relative Date Example',
                placeholder: 'Today by default',
                help_text: 'Defaults to today using relative date',
                optional: true,
                initial_value: 'today',
            },
            {
                type: 'datetime_input',
                name: 'relative_datetime',
                label: 'Relative DateTime Example',
                placeholder: 'Tomorrow by default',
                help_text: 'Defaults to tomorrow using relative date',
                optional: true,
                initial_value: '+1d',
            },
        ];
        break;
    case 'datetime_timezone':
        blocks = [
            {
                type: 'datetime_input',
                name: 'london_dropdown',
                label: 'London Office Hours',
                help_text: 'Times shown in GMT - select from 60 min intervals',
                optional: true,
                datetime_config: {
                    location_timezone: 'Europe/London',
                    time_interval: 60,
                },
            },
        ];
        break;
    case 'datetime_manual':
        blocks = [
            {
                type: 'datetime_input',
                name: 'local_manual',
                label: 'Your Local Time',
                help_text: 'Type any time: 9am, 14:30, 3:45pm - no rounding',
                optional: true,
                datetime_config: {manual_time_entry: true},
            },
            {
                type: 'datetime_input',
                name: 'london_manual',
                label: 'London Manual Entry',
                help_text: 'Type time in GMT: 9am, 14:30, 3:45pm - no rounding',
                optional: true,
                datetime_config: {
                    location_timezone: 'Europe/London',
                    manual_time_entry: true,
                },
            },
        ];
        break;
    default:
        blocks = [
            {
                type: 'date_input',
                name: 'event_date',
                label: 'Event Date',
                placeholder: 'Select a date',
                optional: true,
            },
        ];
    }

    return baseBlockDialog(webhookBaseUrl, {
        title,
        state: `pw-${scenario}`,
        blocks,
    });
}

/**
 * Resolve a block_dialog fixture by Playwright scenario key.
 * @param {string} webhookBaseUrl
 * @param {string} scenario
 * @param {object} options
 */
function getMmBlocksDialogByScenario(webhookBaseUrl, scenario, options = {}) {
    switch (scenario) {
    case 'simple':
        return getMmBlocksSimpleDialog(webhookBaseUrl, options);
    case 'full':
        return getMmBlocksFullDialog(webhookBaseUrl, options);
    case 'boolean':
        return getMmBlocksBooleanDialog(webhookBaseUrl, options);
    case 'users_channels':
        return getMmBlocksUsersChannelsDialog(webhookBaseUrl, options);
    case 'multiselect':
        return getMmBlocksMultiselectDialog(webhookBaseUrl, {...options, includeDefaults: false});
    case 'multiselect_defaults':
        return getMmBlocksMultiselectDialog(webhookBaseUrl, {...options, includeDefaults: true});
    case 'dynamic':
        return getMmBlocksDynamicDialog(webhookBaseUrl, options);
    case 'empty_required':
        return getMmBlocksEmptyRequiredDialog(webhookBaseUrl, options);
    case 'file_upload':
        return getMmBlocksFileUploadDialog(webhookBaseUrl, options);
    case 'field_refresh':
        return getMmBlocksFieldRefreshDialog(webhookBaseUrl, options);
    case 'multistep_1':
        return getMmBlocksMultistep1Dialog(webhookBaseUrl, options);
    case 'multistep_2':
        return getMmBlocksMultistep2Dialog(webhookBaseUrl, options);
    case 'multistep_3':
        return getMmBlocksMultistep3Dialog(webhookBaseUrl, options);
    case 'action_parent':
        return getMmBlocksActionParentDialog(webhookBaseUrl, options);
    case 'datetime_basic':
    case 'datetime_mindate':
    case 'datetime_interval':
    case 'datetime_relative':
    case 'datetime_timezone':
    case 'datetime_manual':
        return getMmBlocksDatetimeDialog(webhookBaseUrl, scenario, options);
    case 'default':
    default: {
        const openPayload = getMmBlocksDialog('unused', webhookBaseUrl, options);
        return openPayload.block_dialog;
    }
    }
}

module.exports = {
    getFullDialog,
    getSimpleDialog,
    getUserAndChannelDialog,
    getBooleanDialog,
    getServerFieldErrorsDialog,
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
    getTimezoneManualDialog,
    getFileUploadDialog,
    getActionButtonParentDialog,
    getActionButtonChildDialog,
    getMmBlocksDialog,
    getMmBlocksDialogStep2,
    getMmBlocksDialogByScenario,
    getMmBlocksFieldRefreshDialog,
    getMmBlocksMultistep1Dialog,
    getMmBlocksMultistep2Dialog,
    getMmBlocksMultistep3Dialog,
    getMmBlocksChildContentDialog,
    getMmBlocksChildOpenRequest,
};
