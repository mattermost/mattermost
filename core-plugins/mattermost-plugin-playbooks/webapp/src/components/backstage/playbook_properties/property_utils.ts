// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PropertyField} from 'src/types/properties';

export const supportsOptions = <T extends Pick<PropertyField, 'type'>>(field: T) => {
    return field.type === 'select' || field.type === 'multiselect';
};

export const hasOptions = <T extends Pick<PropertyField, 'attrs'>>(field: T) => {
    return Boolean(field.attrs?.options && field.attrs.options.length > 0);
};
