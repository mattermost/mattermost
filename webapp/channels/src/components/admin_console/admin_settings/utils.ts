// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, EnvironmentConfig} from '@mattermost/types/config';

function getConfigValue(config: AdminConfig | Partial<EnvironmentConfig>, path: string) {
    const pathParts = path.split('.');

    return pathParts.reduce((obj: object | null, pathPart) => {
        if (!obj) {
            return null;
        }
        return obj[(pathPart as keyof object)];
    }, config);
}

export function isSetByEnv(environmentConfig: Partial<EnvironmentConfig>, path: string) {
    return Boolean(getConfigValue(environmentConfig, path));
}

export const parseIntNonNegative = (str: string | number, defaultValue?: number) => {
    const n = typeof str === 'string' ? parseInt(str, 10) : str;

    if (isNaN(n) || n < 0) {
        if (defaultValue) {
            return defaultValue;
        }
        return 0;
    }

    return n;
};

export const parseIntZeroOrMin = (str: string | number, minimumValue = 1) => {
    const n = typeof str === 'string' ? parseInt(str, 10) : str;

    if (isNaN(n) || n < 0) {
        return 0;
    }
    if (n > 0 && n < minimumValue) {
        return minimumValue;
    }

    return n;
};

export const parseIntNonZero = (str: string | number, defaultValue?: number, minimumValue = 1) => {
    const n = typeof str === 'string' ? parseInt(str, 10) : str;

    if (isNaN(n) || n < minimumValue) {
        if (defaultValue) {
            return defaultValue;
        }
        return 1;
    }

    return n;
};
