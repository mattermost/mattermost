// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppField, AppForm} from '@mattermost/types/apps';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

export function cleanForm(form?: AppForm) {
    if (!form) {
        return;
    }

    const toRemove: number[] = [];
    const usedLabels: {[label: string]: boolean} = {};
    form.fields?.forEach((field, i) => {
        if (!field.name) {
            toRemove.unshift(i);
            return;
        }

        if (field.name.match(/ |\t/)) {
            toRemove.unshift(i);
            return;
        }

        let label = field.label;
        if (!label) {
            label = field.name;
        }

        if (label.match(/ |\t/)) {
            toRemove.unshift(i);
            return;
        }

        if (usedLabels[label]) {
            toRemove.unshift(i);
            return;
        }

        switch (field.type) {
        case AppFieldTypes.STATIC_SELECT:
            cleanStaticSelect(field);
            if (!field.options?.length) {
                toRemove.unshift(i);
                return;
            }
            break;
        case AppFieldTypes.DYNAMIC_SELECT:
            if (!field.lookup) {
                toRemove.unshift(i);
                return;
            }
        }
        usedLabels[label] = true;
    });

    toRemove.forEach((i) => {
        form.fields!.splice(i, 1);
    });
}

function cleanStaticSelect(field: AppField) {
    const toRemove: number[] = [];
    const usedLabels: {[label: string]: boolean} = {};
    const usedValues: {[label: string]: boolean} = {};
    field.options?.forEach((option, i) => {
        let label = option.label;
        if (!label) {
            label = option.value;
        }

        if (!label) {
            toRemove.unshift(i);
            return;
        }

        if (usedLabels[label]) {
            toRemove.unshift(i);
            return;
        }

        if (usedValues[option.value]) {
            toRemove.unshift(i);
            return;
        }

        usedLabels[label] = true;
        usedValues[option.value] = true;
    });

    toRemove.forEach((i) => {
        field.options?.splice(i, 1);
    });
}
