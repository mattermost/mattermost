// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function isObject(obj: any): obj is Record<string, any> {
    return Boolean(obj && typeof obj === 'object' && !Array.isArray(obj));
}

function isSet(obj: unknown): obj is Set<any> {
    return Object.getPrototypeOf(obj) === Set.prototype;
}

function isMap(obj: unknown): obj is Map<any, any> {
    return Object.getPrototypeOf(obj) === Map.prototype;
}

export default function mergeObjects(a: Record<string, any>, b: Record<string, any>, path = '.') {
    if (a === null || a === undefined) {
        return b;
    } else if (b === null || b === undefined) {
        return a;
    }

    let result: any;

    if (isSet(a) && isSet(b)) {
        result = b;
    } else if (isSet(a) || isSet(b)) {
        throw new Error(`Mismatched types: ${path} is a Set from one source but not the other`);
    } else if (isMap(a) && isMap(b)) {
        result = b;
    } else if (isMap(a) || isMap(b)) {
        throw new Error(`Mismatched types: ${path} is a Map from one source but not the other`);
    } else if (isObject(a) && isObject(b)) {
        result = {};

        for (const key of Object.keys(a)) {
            result[key] = mergeObjects(a[key], b[key], path + '.' + key);
        }

        for (const key of Object.keys(b)) {
            if (result.hasOwnProperty(key)) {
                continue;
            }

            result[key] = b[key];
        }
    } else if (isObject(a) || isObject(b)) {
        throw new Error(`Mismatched types: ${path} is an object from one source but not the other`);
    } else {
        result = b;
    }

    return result;
}
