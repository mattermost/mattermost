// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import '@testing-library/jest-dom'

import failOnConsole from 'jest-fail-on-console'

failOnConsole({
    shouldFailOnWarn: false,
})

beforeAll(() => {
    const scrollIntoViewMock = jest.fn()
    globalThis.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
})
