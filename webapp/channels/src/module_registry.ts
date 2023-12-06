// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const modules: Record<string, unknown> = {};

export const getModule = <T>(name: string) => {
    return modules[name] as T;
};

export const setModule = <T>(name: string, component: T) => {
    if (modules[name]) {
        return false;
    }

    modules[name] = component;
    return true;
};
