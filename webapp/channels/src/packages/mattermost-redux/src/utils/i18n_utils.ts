// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type LocalizeFunc = (descriptor: {id: string; defaultMessage?: string}) => string;

let localizeFunction: LocalizeFunc;

export function setLocalizeFunction(func: LocalizeFunc) {
    localizeFunction = func;
}

export function localizeMessage(descriptor: {id: string; defaultMessage?: string}): string {
    if (!localizeFunction) {
        return descriptor.defaultMessage ?? '';
    }

    return localizeFunction(descriptor);
}
