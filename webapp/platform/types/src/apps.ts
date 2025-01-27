// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isProductScope, type ProductScope} from './products';
import {isArrayOf, isStringArray} from './utilities';

export enum Permission {
    UserJoinedChannelNotification = 'user_joined_channel_notification',
    ActAsBot = 'act_as_bot',
    ActAsUser = 'act_as_user',
    PermissionActAsAdmin = 'act_as_admin',
    RemoteOAuth2 = 'remote_oauth2',
    RemoteWebhooks = 'remote_webhooks',
}

export enum Locations {
    PostMenu = '/post_menu',
    ChannelHeader = '/channel_header',
    Command = '/command',
    InPost = '/in_post',
}

export type AppManifest = {
    app_id: string;
    version?: string;
    homepage_url?: string;
    icon?: string;
    display_name: string;
    description?: string;
    requested_permissions?: Permission[];
    requested_locations?: Locations[];
}

export type AppModalState = {
    form: AppForm;
    call: AppCallRequest;
}

export type AppCommandFormMap = { [location: string]: AppForm }

export type BindingsInfo = {
    bindings: AppBinding[];
    forms: AppCommandFormMap;
}

export type AppsState = {
    main: BindingsInfo;
    rhs: BindingsInfo;
    pluginEnabled: boolean;
};

export type AppBinding = {
    app_id: string;
    location?: string;
    supported_product_ids?: ProductScope;
    icon?: string;

    // Label is the (usually short) primary text to display at the location.
    // - For LocationPostMenu is the menu item text.
    // - For LocationChannelHeader is the dropdown text.
    // - For LocationCommand is the name of the command
    label: string;

    // Hint is the secondary text to display
    // - LocationPostMenu: not used
    // - LocationChannelHeader: tooltip
    // - LocationCommand: the "Hint" line
    hint?: string;

    // Description is the (optional) extended help text, used in modals and autocomplete
    description?: string;

    role_id?: string;
    depends_on_team?: boolean;
    depends_on_channel?: boolean;
    depends_on_user?: boolean;
    depends_on_post?: boolean;

    // A Binding is either an action (makes a call), a Form, or is a
    // "container" for other locations - i.e. menu sub-items or subcommands.
    bindings?: AppBinding[];
    form?: AppForm;
    submit?: AppCall;
};

export function isAppBinding(obj: unknown): obj is AppBinding {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const binding = obj as AppBinding;

    if (typeof binding.app_id !== 'string' || typeof binding.label !== 'string') {
        return false;
    }

    if (binding.location !== undefined && typeof binding.location !== 'string') {
        return false;
    }

    if (binding.supported_product_ids !== undefined && !isProductScope(binding.supported_product_ids)) {
        return false;
    }

    if (binding.icon !== undefined && typeof binding.icon !== 'string') {
        return false;
    }

    if (binding.hint !== undefined && typeof binding.hint !== 'string') {
        return false;
    }

    if (binding.description !== undefined && typeof binding.description !== 'string') {
        return false;
    }

    if (binding.role_id !== undefined && typeof binding.role_id !== 'string') {
        return false;
    }

    if (binding.depends_on_team !== undefined && typeof binding.depends_on_team !== 'boolean') {
        return false;
    }

    if (binding.depends_on_channel !== undefined && typeof binding.depends_on_channel !== 'boolean') {
        return false;
    }

    if (binding.depends_on_user !== undefined && typeof binding.depends_on_user !== 'boolean') {
        return false;
    }

    if (binding.depends_on_post !== undefined && typeof binding.depends_on_post !== 'boolean') {
        return false;
    }

    if (binding.bindings !== undefined && !isArrayOf(binding.bindings, isAppBinding)) {
        return false;
    }

    if (binding.form !== undefined && !isAppForm(binding.form)) {
        return false;
    }

    if (binding.submit !== undefined && !isAppCall(binding.submit)) {
        return false;
    }

    return true;
}

export type AppCallValues = {
    [name: string]: any;
};

export type AppCall = {
    path: string;
    expand?: AppExpand;
    state?: any;
};

function isAppCall(obj: unknown): obj is AppCall {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const call = obj as AppCall;

    if (typeof call.path !== 'string') {
        return false;
    }

    if (call.expand !== undefined && !isAppExpand(call.expand)) {
        return false;
    }

    // Here we're assuming that 'state' can be of any type, so no type check for 'state'

    return true;
}

export type AppCallRequest = AppCall & {
    context: AppContext;
    values?: AppCallValues;
    raw_command?: string;
    selected_field?: string;
    query?: string;
};

export type AppCallResponseType = string;

export type AppCallResponse<Res = unknown> = {
    type: AppCallResponseType;
    text?: string;
    data?: Res;
    navigate_to_url?: string;
    use_external_browser?: boolean;
    call?: AppCall;
    form?: AppForm;
    app_metadata?: AppMetadataForClient;
};

export type AppMetadataForClient = {
    bot_user_id: string;
    bot_username: string;
}

export type AppContext = {
    app_id: string;
    location?: string;
    acting_user_id?: string;
    user_id?: string;
    channel_id?: string;
    team_id?: string;
    post_id?: string;
    root_id?: string;
    props?: AppContextProps;
    user_agent?: string;
    track_as_submit?: boolean;
};

export type AppContextProps = {
    [name: string]: string;
};

export type AppExpandLevel = ''
| 'none'
| 'summary'
| '+summary'
| 'all'
| '+all'
| 'id';

export type AppExpand = {
    app?: AppExpandLevel;
    acting_user?: AppExpandLevel;
    acting_user_access_token?: AppExpandLevel;
    channel?: AppExpandLevel;
    config?: AppExpandLevel;
    mentioned?: AppExpandLevel;
    parent_post?: AppExpandLevel;
    post?: AppExpandLevel;
    root_post?: AppExpandLevel;
    team?: AppExpandLevel;
    user?: AppExpandLevel;
    locale?: AppExpandLevel;
};

function isAppExpand(v: unknown): v is AppExpand {
    if (typeof v !== 'object' || v === null) {
        return false;
    }

    const expand = v as AppExpand;

    if (expand.app !== undefined && typeof expand.app !== 'string') {
        return false;
    }

    if (expand.acting_user !== undefined && typeof expand.acting_user !== 'string') {
        return false;
    }

    if (expand.acting_user_access_token !== undefined && typeof expand.acting_user_access_token !== 'string') {
        return false;
    }

    if (expand.channel !== undefined && typeof expand.channel !== 'string') {
        return false;
    }

    if (expand.config !== undefined && typeof expand.config !== 'string') {
        return false;
    }

    if (expand.mentioned !== undefined && typeof expand.mentioned !== 'string') {
        return false;
    }

    if (expand.parent_post !== undefined && typeof expand.parent_post !== 'string') {
        return false;
    }

    if (expand.post !== undefined && typeof expand.post !== 'string') {
        return false;
    }

    if (expand.root_post !== undefined && typeof expand.root_post !== 'string') {
        return false;
    }

    if (expand.team !== undefined && typeof expand.team !== 'string') {
        return false;
    }

    if (expand.user !== undefined && typeof expand.user !== 'string') {
        return false;
    }

    if (expand.locale !== undefined && typeof expand.locale !== 'string') {
        return false;
    }

    return true;
}

export type AppForm = {
    title?: string;
    header?: string;
    footer?: string;
    icon?: string;
    submit_buttons?: string;
    cancel_button?: boolean;
    submit_on_cancel?: boolean;
    fields?: AppField[];

    // source is used in 2 cases:
    //   - if submit is not set, it is used to fetch the submittable form from
    //     the app.
    //   - if a select field change triggers a refresh, the form is refreshed
    //     from source.
    source?: AppCall;

    // submit is called when one of the submit buttons is pressed, or the
    // command is executed.
    submit?: AppCall;

    depends_on?: string[];
};

function isAppForm(v: unknown): v is AppForm {
    if (typeof v !== 'object' || v === null) {
        return false;
    }

    const form = v as AppForm;

    if (form.title !== undefined && typeof form.title !== 'string') {
        return false;
    }

    if (form.header !== undefined && typeof form.header !== 'string') {
        return false;
    }

    if (form.footer !== undefined && typeof form.footer !== 'string') {
        return false;
    }

    if (form.icon !== undefined && typeof form.icon !== 'string') {
        return false;
    }

    if (form.submit_buttons !== undefined && typeof form.submit_buttons !== 'string') {
        return false;
    }

    if (form.cancel_button !== undefined && typeof form.cancel_button !== 'boolean') {
        return false;
    }

    if (form.submit_on_cancel !== undefined && typeof form.submit_on_cancel !== 'boolean') {
        return false;
    }

    if (form.fields !== undefined && !isArrayOf(form.fields, isAppField)) {
        return false;
    }

    if (form.source !== undefined && !isAppCall(form.source)) {
        return false;
    }

    if (form.submit !== undefined && !isAppCall(form.submit)) {
        return false;
    }

    if (form.depends_on !== undefined && !isStringArray(form.depends_on)) {
        return false;
    }

    return true;
}

export type AppFormValue = string | AppSelectOption | boolean | null;

function isAppFormValue(v: unknown): v is AppFormValue {
    if (typeof v === 'string') {
        return true;
    }

    if (typeof v === 'boolean') {
        return true;
    }

    if (v === null) {
        return true;
    }

    return isAppSelectOption(v);
}

export type AppFormValues = { [name: string]: AppFormValue };

export type AppSelectOption = {
    label: string;
    value: string;
    icon_data?: string;
};

function isAppSelectOption(v: unknown): v is AppSelectOption {
    if (typeof v !== 'object' || v === null) {
        return false;
    }

    const option = v as AppSelectOption;

    if (typeof option.label !== 'string' || typeof option.value !== 'string') {
        return false;
    }

    if (option.icon_data !== undefined && typeof option.icon_data !== 'string') {
        return false;
    }

    return true;
}

export type AppFieldType = string;

// This should go in mattermost-redux
export type AppField = {

    // Name is the name of the JSON field to use.
    name: string;
    type: AppFieldType;
    is_required?: boolean;
    readonly?: boolean;

    // Present (default) value of the field
    value?: AppFormValue;

    description?: string;

    label?: string;
    hint?: string;
    position?: number;

    modal_label?: string;

    // Select props
    refresh?: boolean;
    options?: AppSelectOption[];
    multiselect?: boolean;
    lookup?: AppCall;

    // Text props
    subtype?: string;
    min_length?: number;
    max_length?: number;
};

function isAppField(v: unknown): v is AppField {
    if (typeof v !== 'object' || v === null) {
        return false;
    }

    const field = v as AppField;

    if (typeof field.name !== 'string' || typeof field.type !== 'string') {
        return false;
    }

    if (field.is_required !== undefined && typeof field.is_required !== 'boolean') {
        return false;
    }

    if (field.readonly !== undefined && typeof field.readonly !== 'boolean') {
        return false;
    }

    if (field.value !== undefined && !isAppFormValue(field.value)) {
        return false;
    }

    if (field.description !== undefined && typeof field.description !== 'string') {
        return false;
    }

    if (field.label !== undefined && typeof field.label !== 'string') {
        return false;
    }

    if (field.hint !== undefined && typeof field.hint !== 'string') {
        return false;
    }

    if (field.position !== undefined && typeof field.position !== 'number') {
        return false;
    }

    if (field.modal_label !== undefined && typeof field.modal_label !== 'string') {
        return false;
    }

    if (field.refresh !== undefined && typeof field.refresh !== 'boolean') {
        return false;
    }

    if (field.options !== undefined && !isArrayOf(field.options, isAppSelectOption)) {
        return false;
    }

    if (field.multiselect !== undefined && typeof field.multiselect !== 'boolean') {
        return false;
    }

    if (field.lookup !== undefined && !isAppCall(field.lookup)) {
        return false;
    }

    if (field.subtype !== undefined && typeof field.subtype !== 'string') {
        return false;
    }

    if (field.min_length !== undefined && typeof field.min_length !== 'number') {
        return false;
    }

    if (field.max_length !== undefined && typeof field.max_length !== 'number') {
        return false;
    }

    return true;
}

export type AutocompleteSuggestion = {
    suggestion: string;
    complete?: string;
    description?: string;
    hint?: string;
    iconData?: string;
}

export type AutocompleteSuggestionWithComplete = AutocompleteSuggestion & {
    complete: string;
}

export type AutocompleteElement = AppField;
export type AutocompleteStaticSelect = AutocompleteElement & {
    options: AppSelectOption[];
};

export type AutocompleteDynamicSelect = AutocompleteElement;

export type AutocompleteUserSelect = AutocompleteElement;

export type AutocompleteChannelSelect = AutocompleteElement;

export type FormResponseData = {
    errors?: {
        [field: string]: string;
    };
}

export type AppLookupResponse = {
    items: AppSelectOption[];
}
