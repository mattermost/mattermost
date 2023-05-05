// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {
    act,
    render,
    waitFor,
    within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {MockStoreEnhanced} from 'redux-mock-store'
import {Provider as ReduxProvider} from 'react-redux'

import {Board, IPropertyTemplate, MemberRole} from 'src/blocks/board'
import {mockStateStore, wrapDNDIntl} from 'src/testUtils'

import {IUser} from 'src/user'
import {Team} from 'src/store/teams'

import BoardTemplateSelectorItem from './boardTemplateSelectorItem'

jest.mock('react-router-dom', () => {
    const originalModule = jest.requireActual('react-router-dom')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {url: '/'}
        }),
    }
})

const groupProperty: IPropertyTemplate = {
    id: 'group-prop-id',
    name: 'name',
    type: 'text',
    options: [
        {
            color: 'propColorOrange',
            id: 'property_value_id_1',
            value: 'Q1',
        },
        {
            color: 'propColorBlue',
            id: 'property_value_id_2',
            value: 'Q2',
        },
    ],
}

jest.mock('src/utils')
jest.mock('src/mutator')

describe('components/boardTemplateSelector/boardTemplateSelectorItem', () => {
    const team1: Team = {
        id: 'team-1',
        title: 'Team 1',
        signupToken: '',
        updateAt: 0,
        modifiedBy: 'user-1',
    }

    const template: Board = {
        id: '1',
        teamId: 'team-1',
        title: 'Template 1',
        createdBy: 'user-1',
        modifiedBy: 'user-1',
        createAt: 10,
        updateAt: 20,
        deleteAt: 0,
        description: 'test',
        showDescription: false,
        type: 'board',
        minimumRole: MemberRole.Editor,
        isTemplate: true,
        templateVersion: 0,
        icon: '🚴🏻‍♂️',
        cardProperties: [groupProperty],
        properties: {},
    }

    const globalTemplate: Board = {
        id: 'global-1',
        title: 'Template global',
        teamId: '0',
        createdBy: 'system',
        modifiedBy: 'system',
        createAt: 10,
        updateAt: 20,
        deleteAt: 0,
        type: 'board',
        minimumRole: MemberRole.Editor,
        icon: '🚴🏻‍♂️',
        description: 'test',
        showDescription: false,
        cardProperties: [groupProperty],
        isTemplate: true,
        templateVersion: 2,
        properties: {},
    }

    const me: IUser = {
        id: 'user-id-1',
        username: 'username_1',
        nickname: '',
        firstname: '',
        lastname: '',
        email: '',
        props: {},
        create_at: 0,
        update_at: 0,
        is_bot: false,
        is_guest: false,
        roles: 'system_user',
    }

    let store: MockStoreEnhanced<unknown, unknown>
    beforeEach(() => {
        jest.clearAllMocks()
        const state = {
            teams: {
                current: team1,
            },
            boards: {
                current: '1',
                myBoardMemberships: {
                    1: {userId: me.id, schemeAdmin: true},
                },
                templates: {
                    [template.id]: template,
                },
            },
        }
        store = mockStateStore([], state)
    })

    test('should match snapshot', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorItem
                    isActive={false}
                    template={template}
                    onSelect={jest.fn()}
                    onDelete={jest.fn()}
                    onEdit={jest.fn()}
                />
            </ReduxProvider>
            ,
        ))
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot when active', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorItem
                    isActive={true}
                    template={template}
                    onSelect={jest.fn()}
                    onDelete={jest.fn()}
                    onEdit={jest.fn()}
                />
            </ReduxProvider>
            ,
        ))
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with global template', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorItem
                    isActive={false}
                    template={globalTemplate}
                    onSelect={jest.fn()}
                    onDelete={jest.fn()}
                    onEdit={jest.fn()}
                />
            </ReduxProvider>
            ,
        ))
        expect(container).toMatchSnapshot()
    })

    test('should trigger the onSelect (and not any other) when click the element', async () => {
        const onSelect = jest.fn()
        const onDelete = jest.fn()
        const onEdit = jest.fn()
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorItem
                    isActive={false}
                    template={template}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onEdit={onEdit}
                />
            </ReduxProvider>
            ,
        ))
        await userEvent.click(container.querySelector('.BoardTemplateSelectorItem')!)
        expect(onSelect).toBeCalledTimes(1)
        expect(onSelect).toBeCalledWith(template)
        expect(onDelete).not.toBeCalled()
        expect(onEdit).not.toBeCalled()
    })

    test('should trigger the onDelete (and not any other) when click the delete icon', async () => {
        const onSelect = jest.fn()
        const onDelete = jest.fn()
        const onEdit = jest.fn()
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorItem
                    isActive={false}
                    template={template}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onEdit={onEdit}
                />
            </ReduxProvider>
            ,
        ))
        await userEvent.click(container.querySelector('.BoardTemplateSelectorItem .EditIcon')!)
        expect(onEdit).toBeCalledTimes(1)
        expect(onEdit).toBeCalledWith(template.id)
        expect(onSelect).not.toBeCalled()
        expect(onDelete).not.toBeCalled()
    })

    test('should trigger the onDelete (and not any other) when click the delete icon and confirm', async () => {
        const onSelect = jest.fn()
        const onDelete = jest.fn()
        const onEdit = jest.fn()

        const root = document.createElement('div')
        root.setAttribute('id', 'focalboard-root-portal')
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorItem
                    isActive={false}
                    template={template}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onEdit={onEdit}
                />
            </ReduxProvider>
            ,
        ), {container: document.body.appendChild(root)})
        await act(() => userEvent.click(root.querySelector('.BoardTemplateSelectorItem .DeleteIcon')!))

        expect(root).toMatchSnapshot()

        const {getByText} = within(root)
        await act(() => userEvent.click(getByText('Delete')!))

        await waitFor(async () => expect(onDelete).toBeCalledTimes(1))
        await waitFor(async () => expect(onDelete).toBeCalledWith(template))
        await waitFor(async () => expect(onSelect).not.toBeCalled())
        await waitFor(async () => expect(onEdit).not.toBeCalled())
    })
})
