// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AppBinding, AppField, AppForm} from '@mattermost/types/apps';

import {AppBindingLocations, AppFieldTypes} from 'mattermost-redux/constants/apps';

export function cleanBinding(binding: AppBinding, topLocation: string) {
    cleanBindingRec(binding, topLocation, 0);
}

function cleanBindingRec(binding: AppBinding, topLocation: string, depth: number) {
    if (!binding) {
        return;
    }

    const toRemove: number[] = [];
    const usedLabels: {[label: string]: boolean} = {};
    binding.bindings?.forEach((b, i) => {
        // Inheritance and defaults

        if (!b.app_id) {
            b.app_id = binding.app_id;
        }

        if (!b.label) {
            b.label = b.location || '';
        }

        b.location = binding.location + '/' + b.location;

        // Validation
        if (!b.app_id) {
            toRemove.unshift(i);
            return;
        }

        // No empty labels nor "whitespace" labels
        if (!b.label.trim()) {
            toRemove.unshift(i);
            return;
        }

        switch (topLocation) {
        case AppBindingLocations.COMMAND: {
            if (b.label.match(/ |\t/)) {
                toRemove.unshift(i);
                return;
            }

            if (usedLabels[b.label]) {
                toRemove.unshift(i);
                return;
            }
            break;
        }
        case AppBindingLocations.CHANNEL_HEADER_ICON: {
            // First level of channel header icons must have an icon to show as the icon
            if (!b.icon && depth === 0) {
                toRemove.unshift(i);
                return;
            }
            break;
        }
        }

        // Must have only subbindings, a form or a submit call.
        const hasBindings = Boolean(b.bindings?.length);
        const hasForm = Boolean(b.form);
        const hasSubmit = Boolean(b.submit);
        if ((!hasBindings && !hasForm && !hasSubmit) ||
            (hasBindings && hasForm) ||
            (hasBindings && hasSubmit) ||
            (hasForm && hasSubmit)) {
            toRemove.unshift(i);
            return;
        }

        if (hasBindings) {
            cleanBindingRec(b, topLocation, depth + 1);

            // Remove invalid branches
            if (!b.bindings?.length) {
                toRemove.unshift(i);
                return;
            }
        } else if (hasForm) {
            if (!b.form?.submit && !b.form?.source) {
                toRemove.unshift(i);
                return;
            }

            cleanForm(b.form);
        }

        usedLabels[b.label] = true;
    });

    toRemove.forEach((i) => {
        binding.bindings?.splice(i, 1);
    });
}

export function validateBindings(bindings: AppBinding[] = []): AppBinding[] {
    const channelHeaderBindings = bindings?.filter((b) => b.location === AppBindingLocations.CHANNEL_HEADER_ICON);
    const postMenuBindings = bindings?.filter((b) => b.location === AppBindingLocations.POST_MENU_ITEM);
    const commandBindings = bindings?.filter((b) => b.location === AppBindingLocations.COMMAND);

    channelHeaderBindings.forEach((b) => cleanBinding(b, AppBindingLocations.CHANNEL_HEADER_ICON));
    postMenuBindings.forEach((b) => cleanBinding(b, AppBindingLocations.POST_MENU_ITEM));
    commandBindings.forEach((b) => cleanBinding(b, AppBindingLocations.COMMAND));

    const hasBindings = (b: AppBinding) => b.bindings?.length;
    return postMenuBindings.filter(hasBindings).concat(channelHeaderBindings.filter(hasBindings), commandBindings.filter(hasBindings));
}

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
