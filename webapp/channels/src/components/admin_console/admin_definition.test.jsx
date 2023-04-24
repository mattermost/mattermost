// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as yup from 'yup';

import adminDefinition from 'components/admin_console/admin_definition.jsx';
import {Constants} from 'utils/constants';

const baseShape = {
    label: yup.string().required(),
    label_default: yup.string().required(),
    needs_no_license: yup.boolean(),
    needs_license: yup.boolean(),
    needs: yup.array().of(yup.array().of(yup.string())),
    needs_or: yup.array().of(yup.array().of(yup.string())),
};

const fieldShape = {
    ...baseShape,
    key: yup.string().required(),

    // help_text: yup.string(), // Commented out since this doesn't work when help_text is a ReactNode

    help_text_default: yup.string(),
    help_text_html: yup.boolean(),
    help_text_values: yup.object(),
};

const option = yup.object().shape({
    value: yup.string(),
    display_name: yup.string().required(),
    display_name_default: yup.string().required(),
});

const settingBanner = yup.object().shape({
    ...baseShape,
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_BANNER]),
    banner_type: yup.mixed().oneOf(['info', 'warning']),
});

const settingBool = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_BOOL]),
    ...fieldShape,
});

const settingNumber = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_NUMBER]),
    ...fieldShape,
});

const settingColor = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_COLOR]),
    ...fieldShape,
});

const settingText = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_TEXT]),
    ...fieldShape,
    placeholder: yup.string(),
    placeholder_default: yup.string(),
});

const settingButton = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_BUTTON]),
    ...fieldShape,
    action: yup.object(),
    error_message: yup.string().required(),
    error_message_default: yup.string().required(),
});

const settingLanguage = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_LANGUAGE]),
    ...fieldShape,
});

const settingMultiLanguage = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_LANGUAGE]),
    ...fieldShape,
    multiple: yup.boolean(),
    no_result: yup.string().required(),
    no_result_default: yup.string().required(),
    not_present: yup.string().required(),
    not_present_default: yup.string().required(),
});

const settingDropdown = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_DROPDOWN]),
    ...fieldShape,
    options: yup.array().of(option),
});

const settingCustom = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_CUSTOM]),
    ...baseShape,
    component: yup.object().required(),
});

const settingPermission = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_PERMISSION]),
    ...fieldShape,
    permissions_mapping_name: yup.string().required(),
});

const settingJobsTable = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_JOBSTABLE]),
    ...baseShape,
    job_type: yup.string().required(),
    render_job: yup.object().required(),
});

const settingFileUploadButton = yup.object().shape({
    type: yup.mixed().oneOf([Constants.SettingsTypes.TYPE_FILE_UPLOAD]),
    ...fieldShape,
    action: yup.object(),
    remove_help_text: yup.string().required(),
    remove_help_text_default: yup.string().required(),
    remove_button_text: yup.string().required(),
    remove_button_text_default: yup.string().required(),
    removing_text: yup.string().required(),
    removing_text_default: yup.string().required(),
    uploading_text: yup.string().required(),
    uploading_text_default: yup.string().required(),
    upload_action: yup.object().required(),
    remove_action: yup.object().required(),
    fileType: yup.string().required(),
});

// eslint-disable-next-line no-template-curly-in-string
const setting = yup.mixed().test('is-setting', 'not a valid setting: ${path}', (value) => {
    let valid = false;
    valid = valid || settingBanner.isValidSync(value);
    valid = valid || settingBool.isValidSync(value);
    valid = valid || settingNumber.isValidSync(value);
    valid = valid || settingColor.isValidSync(value);
    valid = valid || settingText.isValidSync(value);
    valid = valid || settingButton.isValidSync(value);
    valid = valid || settingLanguage.isValidSync(value);
    valid = valid || settingMultiLanguage.isValidSync(value);
    valid = valid || settingDropdown.isValidSync(value);
    valid = valid || settingCustom.isValidSync(value);
    valid = valid || settingJobsTable.isValidSync(value);
    valid = valid || settingPermission.isValidSync(value);
    valid = valid || settingFileUploadButton.isValidSync(value);
    return valid;
});

var baseSchema = {
    id: yup.string().required(),
    name: yup.string().required(),
    name_default: yup.string().required(),
};

var schema = yup.object(baseSchema).shape({
    settings: yup.array().of(setting).required(),
});

var sectionSchema = yup.object(baseSchema).shape({
    sections: yup.array().of(schema).required(),
});

var customComponentSchema = yup.object().shape({
    id: yup.string().required(),
    component: yup.object().required(),
});

var definition = yup.object().shape({
    reporting: yup.object().shape({
        system_analytics: yup.object().shape({schema: customComponentSchema}),
        team_analytics: yup.object().shape({schema: customComponentSchema}),
        system_users: yup.object().shape({schema: customComponentSchema}),
        server_logs: yup.object().shape({schema: customComponentSchema}),
    }),
    authentication: yup.object().shape({
        email: yup.object().shape({schema}),
        ldap: yup.object().shape({sectionSchema}),
        mfa: yup.object().shape({schema}),
        saml: yup.object().shape({schema}),
    }),
    settings: yup.object().shape({
        general: yup.object().shape({
            configuration: yup.object().shape({schema}),
            localization: yup.object().shape({schema}),
            users_and_teams: yup.object().shape({schema}),
            privacy: yup.object().shape({schema}),
            compliance: yup.object().shape({schema}),
        }),
        security: yup.object().shape({}),
        notifications: yup.object().shape({}),
        integrations: yup.object().shape({
            custom: yup.object().shape({schema}),
        }),
        plugins: yup.object().shape({}),
        files: yup.object().shape({}),
        customization: yup.object().shape({
            announcement: yup.object().shape({schema}),
        }),
        compliance: yup.object().shape({}),
        advanced: yup.object().shape({}),
    }),
    other: yup.object().shape({
        license: yup.object().shape({schema: customComponentSchema}),
        audits: yup.object().shape({schema: customComponentSchema}),
    }),
});

describe('components/admin_console/admin_definition', () => {
    it('should pass all validations checks', () => {
        definition.strict().validateSync(adminDefinition);
    });
});
