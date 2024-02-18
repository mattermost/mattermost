// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {v4 as uuidv4} from 'uuid';

const second = 1000;
const minute = 60 * 1000;

export const duration = {
    half_sec: second / 2,
    one_sec: second,
    two_sec: second * 2,
    four_sec: second * 4,
    ten_sec: second * 10,
    half_min: minute / 2,
    one_min: minute,
    two_min: minute * 2,
    four_min: minute * 4,
};

/**
 * Explicit `wait` should not normally used but made available for special cases.
 * @param {number} ms - duration in millisecond
 * @return {Promise} promise with timeout
 */
export const wait = async (ms = 0) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * @param {Number} length - length on random string to return, e.g. 7 (default)
 * @return {String} random string
 */
export function getRandomId(length = 7): string {
    const MAX_SUBSTRING_INDEX = 27;

    return uuidv4()
        .replace(/-/g, '')
        .substring(MAX_SUBSTRING_INDEX - length, MAX_SUBSTRING_INDEX);
}

// Default team is meant for sysadmin's primary team,
// selected for compatibility with existing local development.
// It should not be used for testing.
export const defaultTeam = {name: 'ad-1', displayName: 'eligendi', type: 'O'};

export const illegalRe = /[/?<>\\:*|":&();]/g;
export const simpleEmailRe = /\S+@\S+\.\S+/;
