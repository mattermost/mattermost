// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/dom'

export const keyDownEscapeLegacy = (element: Element) => {
    fireEvent.keyDown(element, {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        charCode: 27,
    })
}

export const keyDownEnterLegacy = (element: Element) => {
    fireEvent.keyDown(element, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        charCode: 13,
    })
}
