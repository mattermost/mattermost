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
        introduction_text: 'Select a project type to see different fields',
        elements: [
            createElement('select', {display_name: 'Project Type', name: 'project_type', refresh: true, placeholder: 'Select project type...', options: [{text: 'Web Application', value: 'web'}, {text: 'Mobile App', value: 'mobile'}, {text: 'API Service', value: 'api'}]}),
            createElement('text', {display_name: 'Project Name', name: 'project_name', placeholder: 'Enter project name'}),
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

module.exports = {
    getFullDialog,
    getSimpleDialog,
    getUserAndChannelDialog,
    getBooleanDialog,
    getFieldRefreshDialog,
    getMultistepStep1Dialog,
    getMultistepStep2Dialog,
    getMultistepStep3Dialog,
};
