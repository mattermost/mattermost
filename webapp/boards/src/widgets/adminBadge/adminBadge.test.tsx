// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'

import {wrapIntl} from 'src/testUtils'

import AdminBadge from './adminBadge'

describe('widgets/adminBadge', () => {
    test('should match the snapshot for TeamAdmin', () => {
        const {container} = render(wrapIntl(<AdminBadge permissions={['manage_team']}/>))
        expect(container).toMatchSnapshot()
    })

    test('should match the snapshot for Admin', () => {
        const {container} = render(wrapIntl(<AdminBadge permissions={['manage_team', 'manage_system']}/>))
        expect(container).toMatchSnapshot()
    })

    test('should match the snapshot for empty', () => {
        const {container} = render(wrapIntl(<AdminBadge permissions={[]}/>))
        expect(container).toMatchInlineSnapshot('<div />')
    })

    test('should match the snapshot for invalid permission', () => {
        const {container} = render(wrapIntl(<AdminBadge permissions={['invalid_permission']}/>))
        expect(container).toMatchInlineSnapshot('<div />')
    })
})
