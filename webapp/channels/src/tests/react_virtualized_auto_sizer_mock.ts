// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('react-virtualized-auto-sizer', () => {
    return function AutoSizer({children}: {children: any}) {
        return children({height: 100, width: 100});
    };
});

export default {};
