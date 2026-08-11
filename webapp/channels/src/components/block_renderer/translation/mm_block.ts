// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Native `props.mm_blocks` entries → validated `MmBlock` (same schema; rejects invalid payloads).
// Future: expand with composite block types (e.g. `actions`) that desugar into base blocks.

import type {
    MmBlock,
    MmBoolInputBlock,
    MmButtonBlock,
    MmCollapsibleBlock,
    MmColumnBlock,
    MmColumnSetBlock,
    MmContainerBackground,
    MmContainerBlock,
    MmContainerGap,
    MmContainerMaxHeight,
    MmDateInputBlock,
    MmDateTimeConfig,
    MmDateTimeInputBlock,
    MmDividerBlock,
    MmFileInputBlock,
    MmImageBlock,
    MmImageSize,
    MmSelectInputBlock,
    MmSelectInputStyle,
    MmSelectOptionGroup,
    MmStaticSelectBlock,
    MmStaticSelectOption,
    MmTextBlock,
    MmTextInputBlock,
    MmTextInputSubtype,
} from '@mattermost/types/mm_blocks';
import {ensureString} from '@mattermost/types/utilities';

import {parseMmButtonStyle} from '../utils/button';

const TEXT_REQUIRED_KEYS = ['type', 'text'];
const DIVIDER_REQUIRED_KEYS = ['type'];
const BUTTON_REQUIRED_KEYS = ['type', 'text', 'action_id'];
const STATIC_SELECT_REQUIRED_KEYS = ['type', 'action_id', 'placeholder'];
const TEXT_INPUT_REQUIRED_KEYS = ['type', 'name', 'label'];
const BOOL_INPUT_REQUIRED_KEYS = ['type', 'name', 'label'];
const SELECT_INPUT_REQUIRED_KEYS = ['type', 'name', 'label'];
const DATE_INPUT_REQUIRED_KEYS = ['type', 'name', 'label'];
const DATETIME_INPUT_REQUIRED_KEYS = ['type', 'name', 'label'];
const FILE_INPUT_REQUIRED_KEYS = ['type', 'name', 'label'];
const IMAGE_REQUIRED_KEYS = ['type', 'url'];
const COLUMN_REQUIRED_KEYS = ['type', 'items'];
const COLUMN_SET_REQUIRED_KEYS = ['type', 'columns'];
const CONTAINER_REQUIRED_KEYS = ['type', 'content'];
const COLLAPSIBLE_REQUIRED_KEYS = ['type', 'header', 'content'];
const STATIC_SELECT_OPTION_REQUIRED_KEYS = ['text', 'value'];
const SELECT_OPTION_GROUP_REQUIRED_KEYS = ['label', 'options'];

const MM_IMAGE_SIZES = new Set<MmImageSize>(['auto', 'xsmall', 'small', 'medium', 'large', 'stretch']);
const MM_CONTAINER_GAPS = new Set<MmContainerGap>(['none', 'small', 'medium', 'large', 'xlarge']);
const MM_CONTAINER_BACKGROUNDS = new Set<MmContainerBackground>(['none', 'gray']);
const MM_CONTAINER_MAX_HEIGHTS = new Set<MmContainerMaxHeight>(['none', 'small', 'medium', 'large']);
const MM_TEXT_INPUT_SUBTYPES = new Set<MmTextInputSubtype>(['text', 'email', 'number', 'password', 'tel', 'url']);

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasRequiredKeys(record: Record<string, unknown>, required: string[]): boolean {
    const keySet = new Set(Object.keys(record));
    return required.every((k) => keySet.has(k));
}

function asBoolean(v: unknown): boolean | undefined {
    if (v === undefined) {
        return false;
    }
    if (typeof v !== 'boolean') {
        return undefined;
    }
    return v;
}

function asFiniteNumber(v: unknown): number | undefined {
    if (v === undefined) {
        return undefined;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        return undefined;
    }
    return v;
}

function asStringRecord(v: unknown): Record<string, string> | null {
    if (v === undefined) {
        return null;
    }
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        return null;
    }
    const o = v as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(o)) {
        if (typeof val !== 'string') {
            return null;
        }
        out[key] = val;
    }
    return out;
}

function translateAccentColor(v: unknown): MmContainerBlock['accent_color'] | undefined {
    if (v === undefined) {
        return undefined;
    }
    if (typeof v !== 'string') {
        return undefined;
    }

    return v;
}

function translateStaticSelectOptions(raw: unknown): MmStaticSelectOption[] | undefined | null {
    if (raw === undefined) {
        return undefined;
    }
    if (!Array.isArray(raw)) {
        return null;
    }
    const out: MmStaticSelectOption[] = [];
    for (const el of raw) {
        if (!isRecord(el)) {
            return null;
        }
        if (!hasRequiredKeys(el, STATIC_SELECT_OPTION_REQUIRED_KEYS)) {
            return null;
        }
        if (typeof el.text !== 'string' || typeof el.value !== 'string') {
            return null;
        }
        out.push({text: el.text, value: el.value});
    }
    return out;
}

function translateSelectOptionGroups(raw: unknown): MmSelectOptionGroup[] | undefined | null {
    if (raw === undefined) {
        return undefined;
    }
    if (!Array.isArray(raw)) {
        return null;
    }
    const out: MmSelectOptionGroup[] = [];
    for (const el of raw) {
        if (!isRecord(el)) {
            return null;
        }
        if (!hasRequiredKeys(el, SELECT_OPTION_GROUP_REQUIRED_KEYS)) {
            return null;
        }
        if (typeof el.label !== 'string' || !el.label.trim()) {
            return null;
        }
        const options = translateStaticSelectOptions(el.options);
        if (!options || options.length === 0) {
            return null;
        }
        out.push({label: el.label, options});
    }
    return out;
}

function translateStringArray(raw: unknown): string[] | undefined | null {
    if (raw === undefined) {
        return undefined;
    }
    if (!Array.isArray(raw)) {
        return null;
    }
    const out: string[] = [];
    for (const el of raw) {
        if (typeof el !== 'string') {
            return null;
        }
        out.push(el);
    }
    return out;
}

function translateTextBlock(raw: Record<string, unknown>): MmTextBlock | null {
    if (!hasRequiredKeys(raw, TEXT_REQUIRED_KEYS)) {
        return null;
    }
    if (typeof raw.text !== 'string') {
        return null;
    }
    const isSubtle = asBoolean(raw.is_subtle);
    if (raw.is_subtle !== undefined && isSubtle === undefined) {
        return null;
    }
    let size: MmTextBlock['size'];
    if (raw.size === undefined) {
        size = undefined;
    } else if (raw.size === 'small' || raw.size === 'default') {
        size = raw.size;
    } else {
        return null;
    }
    return {
        type: 'text',
        text: raw.text,
        ...(isSubtle === true ? {is_subtle: true} : {}),
        ...(size ? {size} : {}),
    };
}

function translateDividerBlock(raw: Record<string, unknown>): MmDividerBlock | null {
    if (!hasRequiredKeys(raw, DIVIDER_REQUIRED_KEYS)) {
        return null;
    }
    return {type: 'divider'};
}

function translateButtonBlock(raw: Record<string, unknown>): MmButtonBlock | null {
    if (!hasRequiredKeys(raw, BUTTON_REQUIRED_KEYS)) {
        return null;
    }
    const text = ensureString(raw.text);
    const actionId = ensureString(raw.action_id);
    if (!text.trim() || !actionId.trim()) {
        return null;
    }
    const styleRaw = raw.style;
    let style: MmButtonBlock['style'];
    if (styleRaw === undefined) {
        style = undefined;
    } else if (typeof styleRaw === 'string') {
        style = parseMmButtonStyle(styleRaw);
    } else {
        return null;
    }
    let tooltip: string | undefined;
    if (raw.tooltip === undefined) {
        tooltip = undefined;
    } else if (typeof raw.tooltip === 'string') {
        tooltip = raw.tooltip;
    } else {
        return null;
    }
    const disabled = asBoolean(raw.disabled);
    if (raw.disabled !== undefined && disabled === undefined) {
        return null;
    }
    let query: Record<string, string> | undefined;
    if (raw.query !== undefined) {
        const q = asStringRecord(raw.query);
        if (q === null) {
            return null;
        }
        query = q;
    }
    let cookie: string | undefined;
    if (raw.cookie === undefined) {
        cookie = undefined;
    } else if (typeof raw.cookie === 'string') {
        cookie = raw.cookie;
    } else {
        return null;
    }
    let subtype: MmButtonBlock['subtype'];
    if (raw.subtype === undefined) {
        subtype = undefined;
    } else if (raw.subtype === 'execute' || raw.subtype === 'submit') {
        subtype = raw.subtype;
    } else {
        return null;
    }
    const out: MmButtonBlock = {
        type: 'button',
        text,
        action_id: actionId,
    };
    if (subtype === 'submit') {
        out.subtype = subtype;
    }
    if (style && style !== 'default') {
        out.style = style;
    }
    if (tooltip !== undefined) {
        out.tooltip = tooltip;
    }
    if (disabled === true) {
        out.disabled = true;
    }
    if (query) {
        out.query = query;
    }
    if (cookie !== undefined) {
        out.cookie = cookie;
    }
    return out;
}

function parseOptionalStringField(raw: Record<string, unknown>, key: string): string | undefined | null {
    if (raw[key] === undefined) {
        return undefined;
    }
    if (typeof raw[key] === 'string') {
        return raw[key] as string;
    }
    return null;
}

function parseOptionalBooleanField(raw: Record<string, unknown>, key: string): boolean | undefined | null {
    if (raw[key] === undefined) {
        return undefined;
    }
    if (typeof raw[key] !== 'boolean') {
        return null;
    }
    return raw[key] as boolean;
}

type CommonInputFields = {
    optional?: boolean;
    disabled?: boolean;
    placeholder?: string;
    help_text?: string;
    onChange?: string;
};

/** Parse shared form-input optional/disabled/placeholder/help_text/onChange. Null if invalid. */
function parseCommonInputFields(raw: Record<string, unknown>): CommonInputFields | null {
    const optional = parseOptionalBooleanField(raw, 'optional');
    if (optional === null) {
        return null;
    }
    const disabled = parseOptionalBooleanField(raw, 'disabled');
    if (disabled === null) {
        return null;
    }
    const placeholder = parseOptionalStringField(raw, 'placeholder');
    if (placeholder === null) {
        return null;
    }
    const helpText = parseOptionalStringField(raw, 'help_text');
    if (helpText === null) {
        return null;
    }
    const onChange = parseOptionalStringField(raw, 'onChange');
    if (onChange === null) {
        return null;
    }

    const out: CommonInputFields = {};
    if (optional === true) {
        out.optional = true;
    }
    if (disabled === true) {
        out.disabled = true;
    }
    if (placeholder !== undefined) {
        out.placeholder = placeholder;
    }
    if (helpText !== undefined) {
        out.help_text = helpText;
    }
    if (onChange !== undefined) {
        out.onChange = onChange;
    }
    return out;
}

function translateTextInputBlock(raw: Record<string, unknown>): MmTextInputBlock | null {
    if (!hasRequiredKeys(raw, TEXT_INPUT_REQUIRED_KEYS)) {
        return null;
    }
    const name = ensureString(raw.name);
    const label = ensureString(raw.label);
    if (!name.trim()) {
        return null;
    }

    let subtype: MmTextInputSubtype | undefined;
    if (raw.subtype === undefined) {
        subtype = undefined;
    } else if (typeof raw.subtype === 'string' && MM_TEXT_INPUT_SUBTYPES.has(raw.subtype as MmTextInputSubtype)) {
        subtype = raw.subtype as MmTextInputSubtype;
    } else {
        return null;
    }

    const multiline = parseOptionalBooleanField(raw, 'multiline');
    if (multiline === null) {
        return null;
    }

    const common = parseCommonInputFields(raw);
    if (!common) {
        return null;
    }

    const minLength = asFiniteNumber(raw.min_length);
    if (raw.min_length !== undefined && minLength === undefined) {
        return null;
    }
    const maxLength = asFiniteNumber(raw.max_length);
    if (raw.max_length !== undefined && maxLength === undefined) {
        return null;
    }

    const initialValue = parseOptionalStringField(raw, 'initial_value');
    if (initialValue === null) {
        return null;
    }

    const out: MmTextInputBlock = {
        type: 'text_input',
        name,
        label,
        ...common,
    };
    if (subtype !== undefined && subtype !== 'text') {
        out.subtype = subtype;
    }
    if (multiline === true) {
        out.multiline = true;
    }
    if (minLength !== undefined) {
        out.min_length = minLength;
    }
    if (maxLength !== undefined) {
        out.max_length = maxLength;
    }
    if (initialValue !== undefined) {
        out.initial_value = initialValue;
    }
    return out;
}

function parseDateTimeConfig(raw: unknown): MmDateTimeConfig | undefined | null {
    if (raw === undefined) {
        return undefined;
    }
    if (!isRecord(raw)) {
        return null;
    }
    const out: MmDateTimeConfig = {};
    if (raw.min_date !== undefined) {
        if (typeof raw.min_date !== 'string') {
            return null;
        }
        out.min_date = raw.min_date;
    }
    if (raw.max_date !== undefined) {
        if (typeof raw.max_date !== 'string') {
            return null;
        }
        out.max_date = raw.max_date;
    }
    if (raw.time_interval !== undefined) {
        const n = asFiniteNumber(raw.time_interval);
        if (n === undefined || n <= 0) {
            return null;
        }
        out.time_interval = n;
    }
    if (raw.location_timezone !== undefined) {
        if (typeof raw.location_timezone !== 'string') {
            return null;
        }
        out.location_timezone = raw.location_timezone;
    }
    if (raw.manual_time_entry !== undefined) {
        if (typeof raw.manual_time_entry !== 'boolean') {
            return null;
        }
        out.manual_time_entry = raw.manual_time_entry;
    }
    return out;
}

function translateDateInputBlock(raw: Record<string, unknown>): MmDateInputBlock | null {
    if (!hasRequiredKeys(raw, DATE_INPUT_REQUIRED_KEYS)) {
        return null;
    }
    const name = ensureString(raw.name);
    const label = ensureString(raw.label);
    if (!name.trim()) {
        return null;
    }

    const common = parseCommonInputFields(raw);
    if (!common) {
        return null;
    }
    const initialValue = parseOptionalStringField(raw, 'initial_value');
    if (initialValue === null) {
        return null;
    }
    const datetimeConfig = parseDateTimeConfig(raw.datetime_config);
    if (datetimeConfig === null) {
        return null;
    }

    const out: MmDateInputBlock = {
        type: 'date_input',
        name,
        label,
        ...common,
    };
    if (initialValue !== undefined) {
        out.initial_value = initialValue;
    }
    if (datetimeConfig !== undefined && Object.keys(datetimeConfig).length > 0) {
        out.datetime_config = datetimeConfig;
    }
    return out;
}

function translateDateTimeInputBlock(raw: Record<string, unknown>): MmDateTimeInputBlock | null {
    if (!hasRequiredKeys(raw, DATETIME_INPUT_REQUIRED_KEYS)) {
        return null;
    }
    const name = ensureString(raw.name);
    const label = ensureString(raw.label);
    if (!name.trim()) {
        return null;
    }

    const common = parseCommonInputFields(raw);
    if (!common) {
        return null;
    }
    const initialValue = parseOptionalStringField(raw, 'initial_value');
    if (initialValue === null) {
        return null;
    }
    const datetimeConfig = parseDateTimeConfig(raw.datetime_config);
    if (datetimeConfig === null) {
        return null;
    }

    const out: MmDateTimeInputBlock = {
        type: 'datetime_input',
        name,
        label,
        ...common,
    };
    if (initialValue !== undefined) {
        out.initial_value = initialValue;
    }
    if (datetimeConfig !== undefined && Object.keys(datetimeConfig).length > 0) {
        out.datetime_config = datetimeConfig;
    }
    return out;
}

function translateFileInputBlock(raw: Record<string, unknown>): MmFileInputBlock | null {
    if (!hasRequiredKeys(raw, FILE_INPUT_REQUIRED_KEYS)) {
        return null;
    }
    const name = ensureString(raw.name);
    const label = ensureString(raw.label);
    if (!name.trim()) {
        return null;
    }

    const common = parseCommonInputFields(raw);
    if (!common) {
        return null;
    }
    const allowMultiple = parseOptionalBooleanField(raw, 'allow_multiple');
    if (allowMultiple === null) {
        return null;
    }
    const initialValue = parseOptionalStringField(raw, 'initial_value');
    if (initialValue === null) {
        return null;
    }

    const out: MmFileInputBlock = {
        type: 'file_input',
        name,
        label,
        ...common,
    };
    if (allowMultiple === true) {
        out.allow_multiple = true;
    }
    if (initialValue !== undefined) {
        out.initial_value = initialValue;
    }
    return out;
}

function translateBoolInputBlock(raw: Record<string, unknown>): MmBoolInputBlock | null {
    if (!hasRequiredKeys(raw, BOOL_INPUT_REQUIRED_KEYS)) {
        return null;
    }
    const name = ensureString(raw.name);
    const label = ensureString(raw.label);
    if (!name.trim()) {
        return null;
    }

    const common = parseCommonInputFields(raw);
    if (!common) {
        return null;
    }

    let initialValue: boolean | undefined;
    if (raw.initial_value === undefined) {
        initialValue = undefined;
    } else if (typeof raw.initial_value === 'boolean') {
        initialValue = raw.initial_value;
    } else {
        return null;
    }

    const out: MmBoolInputBlock = {
        type: 'bool_input',
        name,
        label,
        ...common,
    };
    if (initialValue !== undefined) {
        out.initial_value = initialValue;
    }
    return out;
}

function translateSelectInputBlock(raw: Record<string, unknown>): MmSelectInputBlock | null {
    if (!hasRequiredKeys(raw, SELECT_INPUT_REQUIRED_KEYS)) {
        return null;
    }
    const name = ensureString(raw.name);
    const label = ensureString(raw.label);
    if (!name.trim()) {
        return null;
    }

    let style: MmSelectInputStyle | undefined;
    if (raw.style === undefined) {
        style = undefined;
    } else if (raw.style === 'compact' || raw.style === 'expanded') {
        style = raw.style;
    } else {
        return null;
    }

    const common = parseCommonInputFields(raw);
    if (!common) {
        return null;
    }
    const multiselect = parseOptionalBooleanField(raw, 'multiselect');
    if (multiselect === null) {
        return null;
    }

    const options = translateStaticSelectOptions(raw.options);
    if (raw.options !== undefined && options === null) {
        return null;
    }
    const optionGroups = translateSelectOptionGroups(raw.option_groups);
    if (raw.option_groups !== undefined && optionGroups === null) {
        return null;
    }
    if (options && optionGroups) {
        return null;
    }

    const dataSource = parseOptionalStringField(raw, 'data_source');
    if (dataSource === null) {
        return null;
    }
    const dataSourceAction = parseOptionalStringField(raw, 'data_source_action');
    if (dataSourceAction === null) {
        return null;
    }
    const initialOption = parseOptionalStringField(raw, 'initial_option');
    if (initialOption === null) {
        return null;
    }

    const initialOptions = translateStringArray(raw.initial_options);
    if (raw.initial_options !== undefined && initialOptions === null) {
        return null;
    }

    const out: MmSelectInputBlock = {
        type: 'select',
        name,
        label,
        ...common,
    };
    if (style === 'expanded') {
        out.style = style;
    }
    if (multiselect === true) {
        out.multiselect = true;
    }
    if (options) {
        out.options = options;
    }
    if (optionGroups) {
        out.option_groups = optionGroups;
    }
    if (dataSource !== undefined) {
        out.data_source = dataSource;
    }
    if (dataSourceAction !== undefined) {
        out.data_source_action = dataSourceAction;
    }
    if (initialOption !== undefined) {
        out.initial_option = initialOption;
    }
    if (initialOptions) {
        out.initial_options = initialOptions;
    }
    return out;
}

function translateStaticSelectBlock(raw: Record<string, unknown>): MmStaticSelectBlock | null {
    if (!hasRequiredKeys(raw, STATIC_SELECT_REQUIRED_KEYS)) {
        return null;
    }
    const actionId = ensureString(raw.action_id);
    const placeholder = ensureString(raw.placeholder);
    if (!actionId.trim() || !placeholder.trim()) {
        return null;
    }

    const out: MmStaticSelectBlock = {
        type: 'static_select',
        action_id: actionId,
        placeholder,
    };

    let options: MmStaticSelectOption[] | undefined;
    if (raw.options !== undefined) {
        const o = translateStaticSelectOptions(raw.options);
        if (o === null) {
            return null;
        }
        options = o;
    }
    if (options) {
        out.options = options;
    }

    let initialOption: string | undefined;
    if (raw.initial_option === undefined) {
        initialOption = undefined;
    } else if (typeof raw.initial_option === 'string') {
        initialOption = raw.initial_option;
    } else {
        return null;
    }

    if (initialOption !== undefined) {
        out.initial_option = initialOption;
    }

    const disabled = asBoolean(raw.disabled);
    if (raw.disabled !== undefined && disabled === undefined) {
        return null;
    }
    if (disabled === true) {
        out.disabled = true;
    }

    let dataSource: string | undefined;
    if (raw.data_source === undefined) {
        dataSource = undefined;
    } else if (typeof raw.data_source === 'string') {
        dataSource = raw.data_source;
    } else {
        return null;
    }
    if (dataSource !== undefined) {
        out.data_source = dataSource;
    }

    let query: Record<string, string> | undefined;
    if (raw.query !== undefined) {
        const q = asStringRecord(raw.query);
        if (q === null) {
            return null;
        }
        query = q;
    }
    if (query) {
        out.query = query;
    }

    let cookie: string | undefined;
    if (raw.cookie === undefined) {
        cookie = undefined;
    } else if (typeof raw.cookie === 'string') {
        cookie = raw.cookie;
    } else {
        return null;
    }
    if (cookie !== undefined) {
        out.cookie = cookie;
    }

    return out;
}

function translateImageBlock(raw: Record<string, unknown>): MmImageBlock | null {
    if (!hasRequiredKeys(raw, IMAGE_REQUIRED_KEYS)) {
        return null;
    }
    if (typeof raw.url !== 'string' || typeof raw.alt_text !== 'string') {
        return null;
    }
    let title: string | undefined;
    if (raw.title === undefined) {
        title = undefined;
    } else if (typeof raw.title === 'string') {
        title = raw.title;
    } else {
        return null;
    }
    let size: MmImageSize | undefined;
    if (raw.size === undefined) {
        size = undefined;
    } else if (typeof raw.size === 'string' && MM_IMAGE_SIZES.has(raw.size as MmImageSize)) {
        size = raw.size as MmImageSize;
    } else {
        return null;
    }
    let maxWidth: number | undefined;
    if (raw.max_width === undefined) {
        maxWidth = undefined;
    } else {
        maxWidth = asFiniteNumber(raw.max_width);
        if (maxWidth === undefined) {
            return null;
        }
    }
    let maxHeight: number | undefined;
    if (raw.max_height === undefined) {
        maxHeight = undefined;
    } else {
        maxHeight = asFiniteNumber(raw.max_height);
        if (maxHeight === undefined) {
            return null;
        }
    }
    let imageStyle: MmImageBlock['image_style'];
    if (raw.image_style === undefined) {
        imageStyle = undefined;
    } else if (raw.image_style === 'default' || raw.image_style === 'person') {
        imageStyle = raw.image_style;
    } else {
        return null;
    }
    let horizontalAlignment: MmImageBlock['horizontal_alignment'];
    if (raw.horizontal_alignment === undefined) {
        horizontalAlignment = undefined;
    } else if (raw.horizontal_alignment === 'left' || raw.horizontal_alignment === 'center' || raw.horizontal_alignment === 'right') {
        horizontalAlignment = raw.horizontal_alignment;
    } else {
        return null;
    }
    const out: MmImageBlock = {
        type: 'image',
        url: raw.url,
        alt_text: raw.alt_text,
    };
    if (title !== undefined) {
        out.title = title;
    }
    if (size) {
        out.size = size;
    }
    if (maxWidth !== undefined) {
        out.max_width = maxWidth;
    }
    if (maxHeight !== undefined) {
        out.max_height = maxHeight;
    }
    if (imageStyle) {
        out.image_style = imageStyle;
    }
    if (horizontalAlignment) {
        out.horizontal_alignment = horizontalAlignment;
    }
    return out;
}

function translateColumnBlock(raw: Record<string, unknown>): MmColumnBlock | null {
    if (!hasRequiredKeys(raw, COLUMN_REQUIRED_KEYS)) {
        return null;
    }
    if (!Array.isArray(raw.items)) {
        return null;
    }
    const items: MmBlock[] = [];
    for (const el of raw.items) {
        const b = translateMMBlock(el);
        if (b) {
            items.push(b);
        }
    }
    if (items.length === 0) {
        return null;
    }
    let width: MmColumnBlock['width'];
    if (raw.width === undefined) {
        width = undefined;
    } else if (raw.width === 'auto' || raw.width === 'stretch') {
        width = raw.width;
    } else {
        return null;
    }
    let gap: MmContainerGap | undefined;
    if (raw.gap === undefined) {
        gap = undefined;
    } else if (typeof raw.gap === 'string' && MM_CONTAINER_GAPS.has(raw.gap as MmContainerGap)) {
        gap = raw.gap as MmContainerGap;
    } else {
        return null;
    }
    const out: MmColumnBlock = {
        type: 'column',
        items,
    };
    if (width) {
        out.width = width;
    }
    if (gap) {
        out.gap = gap;
    }
    return out;
}

function translateColumnSetBlock(raw: Record<string, unknown>): MmColumnSetBlock | null {
    if (!hasRequiredKeys(raw, COLUMN_SET_REQUIRED_KEYS)) {
        return null;
    }
    if (!Array.isArray(raw.columns)) {
        return null;
    }
    const columns: MmColumnBlock[] = [];
    for (const el of raw.columns) {
        if (!isRecord(el) || el.type !== 'column') {
            return null;
        }
        const col = translateColumnBlock(el);
        if (!col) {
            return null;
        }
        columns.push(col);
    }
    if (columns.length === 0) {
        return null;
    }
    let gap: MmContainerGap | undefined;
    if (raw.gap === undefined) {
        gap = undefined;
    } else if (typeof raw.gap === 'string' && MM_CONTAINER_GAPS.has(raw.gap as MmContainerGap)) {
        gap = raw.gap as MmContainerGap;
    } else {
        return null;
    }
    const out: MmColumnSetBlock = {type: 'column_set', columns};
    if (gap) {
        out.gap = gap;
    }
    return out;
}

function translateContainerBlock(raw: Record<string, unknown>): MmContainerBlock | null {
    if (!hasRequiredKeys(raw, CONTAINER_REQUIRED_KEYS)) {
        return null;
    }
    if (!Array.isArray(raw.content)) {
        return null;
    }
    const content: MmBlock[] = [];
    for (const el of raw.content) {
        const b = translateMMBlock(el);
        if (b) {
            content.push(b);
        }
    }
    if (content.length === 0) {
        return null;
    }
    const border = asBoolean(raw.border);
    if (raw.border !== undefined && border === undefined) {
        return null;
    }
    let accentColor: MmContainerBlock['accent_color'];
    if (raw.accent_color === undefined) {
        accentColor = undefined;
    } else {
        accentColor = translateAccentColor(raw.accent_color);
        if (accentColor === undefined) {
            return null;
        }
    }
    let flow: MmContainerBlock['flow'];
    if (raw.flow === undefined) {
        flow = undefined;
    } else if (raw.flow === 'horizontal' || raw.flow === 'vertical') {
        flow = raw.flow;
    } else {
        return null;
    }
    let gap: MmContainerGap | undefined;
    if (raw.gap === undefined) {
        gap = undefined;
    } else if (typeof raw.gap === 'string' && MM_CONTAINER_GAPS.has(raw.gap as MmContainerGap)) {
        gap = raw.gap as MmContainerGap;
    } else {
        return null;
    }
    let background: MmContainerBackground | undefined;
    if (raw.background === undefined) {
        background = undefined;
    } else if (typeof raw.background === 'string' && MM_CONTAINER_BACKGROUNDS.has(raw.background as MmContainerBackground)) {
        background = raw.background as MmContainerBackground;
    } else {
        return null;
    }
    let containerMaxHeight: MmContainerMaxHeight | undefined;
    if (raw.max_height === undefined) {
        containerMaxHeight = undefined;
    } else if (typeof raw.max_height === 'string' && MM_CONTAINER_MAX_HEIGHTS.has(raw.max_height as MmContainerMaxHeight)) {
        containerMaxHeight = raw.max_height as MmContainerMaxHeight;
    } else {
        return null;
    }
    const out: MmContainerBlock = {
        type: 'container',
        content,
    };
    if (border === true) {
        out.border = true;
    }
    if (accentColor !== undefined) {
        out.accent_color = accentColor;
    }
    if (flow) {
        out.flow = flow;
    }
    if (gap) {
        out.gap = gap;
    }
    if (background) {
        out.background = background;
    }
    if (containerMaxHeight !== undefined) {
        out.max_height = containerMaxHeight;
    }
    return out;
}

function translateCollapsibleBlock(raw: Record<string, unknown>): MmCollapsibleBlock | null {
    if (!hasRequiredKeys(raw, COLLAPSIBLE_REQUIRED_KEYS)) {
        return null;
    }
    if (!Array.isArray(raw.header) || !Array.isArray(raw.content)) {
        return null;
    }
    const header: MmBlock[] = [];
    for (const el of raw.header) {
        const b = translateMMBlock(el);
        if (b) {
            header.push(b);
        }
    }
    const content: MmBlock[] = [];
    for (const el of raw.content) {
        const b = translateMMBlock(el);
        if (b) {
            content.push(b);
        }
    }
    if (header.length === 0 || content.length === 0) {
        return null;
    }
    const out: MmCollapsibleBlock = {
        type: 'collapsible',
        header,
        content,
    };
    if (raw.collapsed !== undefined) {
        const collapsed = asBoolean(raw.collapsed);
        if (collapsed === undefined) {
            return null;
        }
        out.collapsed = collapsed;
    }
    return out;
}

/**
 * Validates a single native mm_blocks entry and returns a normalised `MmBlock`, or null if invalid.
 * Unknown block `type` values are rejected (reserved for future composite desugaring).
 */
export function translateMMBlock(raw: unknown): MmBlock | null {
    if (!isRecord(raw)) {
        return null;
    }
    const t = raw.type;
    if (typeof t !== 'string') {
        return null;
    }
    switch (t) {
    case 'text':
        return translateTextBlock(raw);
    case 'divider':
        return translateDividerBlock(raw);
    case 'button':
        return translateButtonBlock(raw);
    case 'text_input':
        return translateTextInputBlock(raw);
    case 'bool_input':
        return translateBoolInputBlock(raw);
    case 'date_input':
        return translateDateInputBlock(raw);
    case 'datetime_input':
        return translateDateTimeInputBlock(raw);
    case 'file_input':
        return translateFileInputBlock(raw);
    case 'select':
        return translateSelectInputBlock(raw);
    case 'static_select':
        return translateStaticSelectBlock(raw);
    case 'image':
        return translateImageBlock(raw);
    case 'column':
        return translateColumnBlock(raw);
    case 'column_set':
        return translateColumnSetBlock(raw);
    case 'container':
        return translateContainerBlock(raw);
    case 'collapsible':
        return translateCollapsibleBlock(raw);
    default:
        return null;
    }
}

/**
 * Validates each entry in a native `mm_blocks` array. Invalid elements are omitted.
 */
export function translateMMBlocks(blocks: unknown[]): MmBlock[] {
    const out: MmBlock[] = [];
    for (const el of blocks) {
        const b = translateMMBlock(el);
        if (b) {
            out.push(b);
        }
    }
    return out;
}
