// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {jest} from '@jest/globals';

const monacoMock = {
    editor: {
        create: jest.fn(),
        defineTheme: jest.fn(),
        setTheme: jest.fn(),
    },
    languages: {
        registerCompletionItemProvider: jest.fn(),
    },
};

export default monacoMock;
