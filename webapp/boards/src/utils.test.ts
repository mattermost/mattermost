// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl'

import {createMemoryHistory} from 'history'

import {match as routerMatch} from 'react-router-dom'

import {
    Utils,
    IDType,
    ShowFullName,
    ShowNicknameFullName,
    ShowUsername
} from './utils'
import {IUser} from './user'

import {IAppWindow} from './types'

declare let window: IAppWindow

describe('utils', () => {
    describe('assureProtocol', () => {
        test('should passthrough on valid short protocol', () => {
            expect(Utils.ensureProtocol('https://focalboard.com')).toBe('https://focalboard.com')
        })
        test('should passthrough on valid long protocol', () => {
            expect(Utils.ensureProtocol('somecustomprotocol://focalboard.com')).toBe('somecustomprotocol://focalboard.com')
        })

        test('should passthrough on valid short protocol', () => {
            expect(Utils.ensureProtocol('x://focalboard.com')).toBe('x://focalboard.com')
        })

        test('should add a https for empty protocol', () => {
            expect(Utils.ensureProtocol('focalboard.com')).toBe('https://focalboard.com')
        })
    })

    describe('createGuid', () => {
        test('should create 27 char random id for workspace', () => {
            expect(Utils.createGuid(IDType.Workspace)).toMatch(/^w[ybndrfg8ejkmcpqxot1uwisza345h769]{26}$/)
        })
        test('should create 27 char random id for board', () => {
            expect(Utils.createGuid(IDType.Board)).toMatch(/^b[ybndrfg8ejkmcpqxot1uwisza345h769]{26}$/)
        })
        test('should create 27 char random id for card', () => {
            expect(Utils.createGuid(IDType.Card)).toMatch(/^c[ybndrfg8ejkmcpqxot1uwisza345h769]{26}$/)
        })
        test('should create 27 char random id', () => {
            expect(Utils.createGuid(IDType.None)).toMatch(/^7[ybndrfg8ejkmcpqxot1uwisza345h769]{26}$/)
        })
    })

    describe('htmlFromMarkdown', () => {
        test('should not allow XSS on links href on the webapp', () => {
            expect(Utils.htmlFromMarkdown('[]("xss-attack="true"other="whatever)')).toBe('<p><a target="_blank" rel="noreferrer" href="%22xss-attack=%22true%22other=%22whatever" title="" onclick=""></a></p>')
        })

        test('should not allow XSS on links href on the desktop app', () => {
            window.openInNewBrowser = () => null
            const expectedHtml = '<p><a target="_blank" rel="noreferrer" href="%22xss-attack=%22true%22other=%22whatever" title="" onclick=" openInNewBrowser && openInNewBrowser(event.target.href);"></a></p>'
            expect(Utils.htmlFromMarkdown('[]("xss-attack="true"other="whatever)')).toBe(expectedHtml)
            window.openInNewBrowser = null
        })

        test('should encode links', () => {
            expect(Utils.htmlFromMarkdown('https://example.com?title=August<1>2022')).toBe('<p><a target="_blank" rel="noreferrer" href="https://example.com?title=August&lt;1&gt;2022" title="" onclick="">https://example.com?title=August&lt;1&gt;2022</a></p>')
            expect(Utils.htmlFromMarkdown('[Duck Duck Go](https://duckduckgo.com "The best search engine\'s for <privacy>")')).toBe('<p><a target="_blank" rel="noreferrer" href="https://duckduckgo.com" title="The best search engine&#39;s for &lt;privacy&gt;" onclick="">Duck Duck Go</a></p>')
        })

        test('should not double encode title and href', () => {
            expect(Utils.htmlFromMarkdown('https://example.com?title=August%201%20-%202022')).toBe('<p><a target="_blank" rel="noreferrer" href="https://example.com?title=August%201%20-%202022" title="" onclick="">https://example.com?title=August%201%20-%202022</a></p>')
            expect(Utils.htmlFromMarkdown('[Duck Duck Go](https://duckduckgo.com "The best search engine#39;s for &lt;privacy&gt;")')).toBe('<p><a target="_blank" rel="noreferrer" href="https://duckduckgo.com" title="The best search engine#39;s for &lt;privacy&gt;" onclick="">Duck Duck Go</a></p>')
        })
    })

    describe('countCheckboxesInMarkdown', () => {
        test('should count checkboxes', () => {
            const text = `
                ## Header
                - [x] one
                - [ ] two
                - [x] three
            `.replace(/\n\s+/gm, '\n')
            const checkboxes = Utils.countCheckboxesInMarkdown(text)
            expect(checkboxes.total).toBe(3)
            expect(checkboxes.checked).toBe(2)
        })
    })

    describe('display date', () => {
        const intl = createIntl({locale: 'en-us'})

        it('should show month and day for current year', () => {
            const currentYear = new Date().getFullYear()
            const date = new Date(currentYear, 6, 9)
            expect(Utils.displayDate(date, intl)).toBe('July 09')
        })

        it('should show month, day and year for previous year', () => {
            const currentYear = new Date().getFullYear()
            const previousYear = currentYear - 1
            const date = new Date(previousYear, 6, 9)
            expect(Utils.displayDate(date, intl)).toBe(`July 09, ${previousYear}`)
        })
    })

    describe('input date', () => {
        const currentYear = new Date().getFullYear()
        const date = new Date(currentYear, 6, 9)

        it('should show mm/dd/yyyy for current year', () => {
            const intl = createIntl({locale: 'en-us'})
            expect(Utils.inputDate(date, intl)).toBe(`07/09/${currentYear}`)
        })

        it('should show dd/mm/yyyy for current year, es local', () => {
            const intl = createIntl({locale: 'es-es'})
            expect(Utils.inputDate(date, intl)).toBe(`09/07/${currentYear}`)
        })
    })

    describe('display date and time', () => {
        const intl = createIntl({locale: 'en-us'})

        it('should show month, day and time for current year', () => {
            const currentYear = new Date().getFullYear()
            const date = new Date(currentYear, 6, 9, 15, 20)
            expect(Utils.displayDateTime(date, intl)).toBe('July 09, 3:20 PM')
        })

        it('should show month, day, year and time for previous year', () => {
            const currentYear = new Date().getFullYear()
            const previousYear = currentYear - 1
            const date = new Date(previousYear, 6, 9, 5, 35)
            expect(Utils.displayDateTime(date, intl)).toBe(`July 09, ${previousYear}, 5:35 AM`)
        })
    })

    describe('compare versions', () => {
        it('should return one if b > a', () => {
            expect(Utils.compareVersions('0.9.4', '0.10.0')).toBe(1)
        })

        it('should return zero if a = b', () => {
            expect(Utils.compareVersions('1.2.3', '1.2.3')).toBe(0)
        })

        it('should return minus one if b < a', () => {
            expect(Utils.compareVersions('10.9.4', '10.9.2')).toBe(-1)
        })
    })

    describe('showBoard test', () => {
        it('should switch boards', () => {
            const match = {
                params: {
                    boardId: 'board_id_1',
                    viewId: 'view_id_1',
                    cardId: 'card_id_1',
                    teamId: 'team_id_1',
                },
                path: '/team/:teamId/:boardId?/:viewId?/:cardId?',
            } as unknown as routerMatch<{boardId: string, viewId?: string, cardId?: string, teamId?: string}>

            const history = createMemoryHistory()
            history.push = jest.fn()

            Utils.showBoard('board_id_2', match, history)

            expect(history.push).toBeCalledWith('/team/team_id_1/board_id_2')
        })
    })

    describe('getUserDisplayName test', () => {
        const user: IUser = {
            id: 'user-id-1',
            username: 'username_1',
            email: 'test@email.com',
            nickname: 'nickname',
            firstname: 'firstname',
            lastname: 'lastname',
            props: {},
            create_at: 0,
            update_at: 0,
            is_bot: false,
            is_guest: false,
            roles: 'system_user',
        }

        it('should display username, by default', () => {
            const displayName = Utils.getUserDisplayName(user, '')
            expect(displayName).toEqual('username_1')
        })
        it('should display nickname', () => {
            const displayName = Utils.getUserDisplayName(user, ShowNicknameFullName)
            expect(displayName).toEqual('nickname')
        })
        it('should display fullname', () => {
            const displayName = Utils.getUserDisplayName(user, ShowFullName)
            expect(displayName).toEqual('firstname lastname')
        })
        it('should display username', () => {
            const displayName = Utils.getUserDisplayName(user, ShowUsername)
            expect(displayName).toEqual('username_1')
        })
        it('should display full name, no nickname', () => {
            user.nickname = ''
            const displayName = Utils.getUserDisplayName(user, ShowNicknameFullName)
            expect(displayName).toEqual('firstname lastname')
        })
        it('should display username, no nickname, no full name', () => {
            user.nickname = ''
            user.firstname = ''
            user.lastname = ''
            const displayName = Utils.getUserDisplayName(user, ShowNicknameFullName)
            expect(displayName).toEqual('username_1')
        })
    })
})
