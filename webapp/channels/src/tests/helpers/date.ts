// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const fakeDate = (expected: Date): () => void => {
    const OGDate = Date;

    // If any Date or number is passed to the constructor
    // use that instead of our mocked date
    function MockDate(mockOverride?: Date | number) {
        return new OGDate(mockOverride || expected);
    }

    MockDate.UTC = OGDate.UTC;
    MockDate.parse = OGDate.parse;
    MockDate.now = () => expected.getTime();

    // Give our mock Date has the same prototype as Date
    // Some libraries rely on this to identify Date objects
    MockDate.prototype = OGDate.prototype;

    // Our mock is not a full implementation of Date
    // Types will not match but it's good enough for our tests
    global.Date = MockDate as any;

    // Callback function to remove the Date mock
    return () => {
        global.Date = OGDate;
    };
};

export const unixTimestampFromNow = (daysFromNow: number) => {
    const now = new Date();
    return Math.ceil(new Date(now.getTime() + (daysFromNow * 24 * 60 * 60 * 1000)).getTime());
};
