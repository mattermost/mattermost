// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {marked} from 'marked'
import {IntlShape} from 'react-intl'
import moment from 'moment'

import {generatePath, match as routerMatch} from 'react-router-dom'

import {History} from 'history'

import {IUser} from './user'

import {Block} from './blocks/block'
import {BoardMember, Board as BoardType, createBoard} from './blocks/board'
import {createBoardView} from './blocks/boardView'
import {createCard} from './blocks/card'
import {createCommentBlock} from './blocks/commentBlock'
import {IAppWindow} from './types'
import {ChangeHandlerType, WSMessage} from './wsclient'
import {BoardCategoryWebsocketData, Category} from './store/sidebar'
import {UserSettings} from './userSettings'

declare let window: IAppWindow

const imageURLForUser = typeof window === 'undefined' ? undefined : (window as any).Components?.imageURLForUser
const IconClass = 'octo-icon'
const OpenButtonClass = 'open-button'
const SpacerClass = 'octo-spacer'
const HorizontalGripClass = 'HorizontalGrip'
const base32Alphabet = 'ybndrfg8ejkmcpqxot1uwisza345h769'

export const SYSTEM_ADMIN_ROLE = 'system_admin'
export const TEAM_ADMIN_ROLE = 'team_admin'
export type CategoryOrder = string[]

export type WSMessagePayloads = Block | Category | BoardCategoryWebsocketData[] | BoardType | BoardMember | null | CategoryOrder

enum IDType {
    None = '7',
    Workspace = 'w',
    Board = 'b',
    Card = 'c',
    View = 'v',
    Session = 's',
    User = 'u',
    Token = 'k',
    BlockID = 'a',
}

export const KeyCodes: Record<string, [string, number]> = {
    ENTER: ['Enter', 13],
    COMPOSING: ['Composing', 229],
}

export const ShowUsername = 'username'
export const ShowNicknameFullName = 'nickname_full_name'
export const ShowFullName = 'full_name'

class Utils {
    static createGuid(idType: IDType): string {
        const data = Utils.randomArray(16)

        return idType + Utils.base32encode(data, false)
    }

    static blockTypeToIDType(blockType: string | undefined): IDType {
        let ret: IDType = IDType.None
        switch (blockType) {
        case 'workspace':
            ret = IDType.Workspace
            break
        case 'board':
            ret = IDType.Board
            break
        case 'card':
            ret = IDType.Card
            break
        case 'view':
            ret = IDType.View
            break
        }

        return ret
    }

    static getProfilePicture(userId?: string): string {
        const defaultImageUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="fill: rgb(192, 192, 192);"><rect width="100" height="100" /></svg>'

        return imageURLForUser && userId ? imageURLForUser(userId) : defaultImageUrl
    }

    static getUserDisplayName(user: IUser, configNameFormat: string): string {
        let nameFormat = configNameFormat
        if (UserSettings.nameFormat) {
            nameFormat = UserSettings.nameFormat
        }

        // default nameFormat = 'username'
        let displayName = user.username

        if (nameFormat === ShowNicknameFullName) {
            if (user.nickname === '') {
                const fullName = Utils.getFullName(user)
                if (fullName !== '') {
                    displayName = fullName
                }
            } else {
                displayName = user.nickname
            }
        } else if (nameFormat === ShowFullName) {
            const fullName = Utils.getFullName(user)
            if (fullName !== '') {
                displayName = fullName
            }
        }

        return displayName
    }

    static getFullName(user: IUser): string {
        if (user.firstname !== '' && user.lastname !== '') {
            return user.firstname + ' ' + user.lastname
        } else if (user.firstname !== '') {
            return user.firstname
        } else if (user.lastname !== '') {
            return user.lastname
        }

        return ''
    }

    static randomArray(size: number): Uint8Array {
        const crypto = window.crypto || window.msCrypto
        const rands = new Uint8Array(size)
        if (crypto && crypto.getRandomValues) {
            crypto.getRandomValues(rands)
        } else {
            for (let i = 0; i < size; i++) {
                rands[i] = Math.floor((Math.random() * 255))
            }
        }

        return rands
    }

    static base32encode(data: Int8Array | Uint8Array | Uint8ClampedArray, pad: boolean): string {
        const dview = new DataView(data.buffer, data.byteOffset, data.byteLength)
        let bits = 0
        let value = 0
        let output = ''

        // adapted from https://github.com/LinusU/base32-encode
        for (let i = 0; i < dview.byteLength; i++) {
            value = (value << 8) | dview.getUint8(i)
            bits += 8

            while (bits >= 5) {
                output += base32Alphabet[(value >>> (bits - 5)) & 31]
                bits -= 5
            }
        }
        if (bits > 0) {
            output += base32Alphabet[(value << (5 - bits)) & 31]
        }
        if (pad) {
            while ((output.length % 8) !== 0) {
                output += '='
            }
        }

        return output
    }

    // general purpose (non-secure) hash
    static hashCode(s: string) {
        let h = 0
        for (let i = 0; i < s.length; i++) {
            h = Math.imul(31, h) + s.charCodeAt(i) | 0
        }

        return h
    }

    static htmlToElement(html: string): HTMLElement {
        const template = document.createElement('template')
        template.innerHTML = html.trim()

        return template.content.firstChild as HTMLElement
    }

    static getElementById(elementId: string): HTMLElement {
        const element = document.getElementById(elementId)
        Utils.assert(element, `getElementById "${elementId}$`)

        return element!
    }

    static htmlEncode(text: string): string {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    static htmlDecode(text: string): string {
        return String(text).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    }

    // re-use canvas object for better performance
    static canvas: HTMLCanvasElement | undefined
    static getTextWidth(displayText: string, fontDescriptor: string): number {
        if (displayText !== '') {
            if (!Utils.canvas) {
                Utils.canvas = document.createElement('canvas') as HTMLCanvasElement
            }
            const context = Utils.canvas.getContext('2d')
            if (context) {
                context.font = fontDescriptor
                const metrics = context.measureText(displayText)

                return Math.ceil(metrics.width)
            }
        }

        return 0
    }

    static getFontAndPaddingFromCell = (cell: Element): {fontDescriptor: string, padding: number} => {
        const style = getComputedStyle(cell)
        const padding = Utils.getTotalHorizontalPadding(style)

        return Utils.getFontAndPaddingFromChildren(cell.children, padding)
    }

    // recursive routine to determine the padding and font from its children
    // specifically for the table view
    static getFontAndPaddingFromChildren = (children: HTMLCollection, pad: number): {fontDescriptor: string, padding: number} => {
        const myResults = {
            fontDescriptor: '',
            padding: pad,
        }
        Array.from(children).forEach((element) => {
            const style = getComputedStyle(element)
            if (element.tagName === 'svg') {
                // clientWidth already includes padding
                myResults.padding += element.clientWidth
                myResults.padding += Utils.getHorizontalBorder(style)
                myResults.padding += Utils.getHorizontalMargin(style)
                myResults.fontDescriptor = Utils.getFontString(style)
            } else {
                switch (element.className) {
                case IconClass:
                case HorizontalGripClass:
                    myResults.padding += element.clientWidth
                    break
                case SpacerClass:
                case OpenButtonClass:
                    break
                default: {
                    myResults.fontDescriptor = Utils.getFontString(style)
                    myResults.padding += Utils.getTotalHorizontalPadding(style)
                    const childResults = Utils.getFontAndPaddingFromChildren(element.children, myResults.padding)
                    if (childResults.fontDescriptor !== '') {
                        myResults.fontDescriptor = childResults.fontDescriptor
                        myResults.padding = childResults.padding
                    }
                }
                }
            }
        })

        return myResults
    }

    private static getFontString(style: CSSStyleDeclaration): string {
        if (style.font) {
            return style.font
        }
        const {fontStyle, fontVariant, fontWeight, fontSize, lineHeight, fontFamily} = style
        const props = [fontStyle, fontVariant, fontWeight]
        if (fontSize) {
            props.push(lineHeight ? `${fontSize} / ${lineHeight}` : fontSize)
        }
        props.push(fontFamily)

        return props.join(' ')
    }

    private static getHorizontalMargin(style: CSSStyleDeclaration): number {
        return parseInt(style.marginLeft, 10) + parseInt(style.marginRight, 10)
    }

    private static getHorizontalBorder(style: CSSStyleDeclaration): number {
        return parseInt(style.borderLeftWidth, 10) + parseInt(style.borderRightWidth, 10)
    }

    private static getHorizontalPadding(style: CSSStyleDeclaration): number {
        return parseInt(style.paddingLeft, 10) + parseInt(style.paddingRight, 10)
    }

    private static getTotalHorizontalPadding(style: CSSStyleDeclaration): number {
        return Utils.getHorizontalPadding(style) + Utils.getHorizontalMargin(style) + Utils.getHorizontalBorder(style)
    }

    // Markdown

    static htmlFromMarkdown(text: string): string {
        // HACKHACK: Somehow, marked doesn't encode angle brackets
        const renderer = new marked.Renderer()
        renderer.link = (href, title, contents) => {
            return '<a ' +
                'target="_blank" ' +
                'rel="noreferrer" ' +
                `href="${encodeURI(decodeURI(href || ''))}" ` +
                `title="${title || ''}" ` +
                `onclick="${(window.openInNewBrowser ? ' openInNewBrowser && openInNewBrowser(event.target.href);' : '')}"` +
            '>' + contents + '</a>'
        }

        renderer.table = (header, body) => {
            return `<div class="table-responsive"><table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`
        }

        return this.htmlFromMarkdownWithRenderer(text, renderer)
    }

    static htmlFromMarkdownWithRenderer(text: string, renderer: marked.Renderer): string {
        const html = marked(text.replace(/</g, '&lt;'), {renderer, breaks: true})

        return html.trim()
    }

    static countCheckboxesInMarkdown(text: string): {total: number, checked: number} {
        let total = 0
        let checked = 0
        const renderer = new marked.Renderer()
        renderer.checkbox = (isChecked) => {
            ++total
            if (isChecked) {
                ++checked
            }

            return ''
        }
        this.htmlFromMarkdownWithRenderer(text, renderer)

        return {total, checked}
    }

    // Date and Time
    private static yearOption(date: Date) {
        const isCurrentYear = date.getFullYear() === new Date().getFullYear()

        return isCurrentYear ? undefined : 'numeric'
    }

    static displayDate(date: Date, intl: IntlShape): string {
        return intl.formatDate(date, {
            year: Utils.yearOption(date),
            month: 'long',
            day: '2-digit',
        })
    }

    static inputDate(date: Date, intl: IntlShape): string {
        return intl.formatDate(date, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
    }

    static displayDateTime(date: Date, intl: IntlShape): string {
        return intl.formatDate(date, {
            year: Utils.yearOption(date),
            month: 'long',
            day: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
        })
    }

    static relativeDisplayDateTime(date: Date, intl: IntlShape): string {
        return moment(date).locale(intl.locale.toLowerCase()).fromNow()
    }

    static sleep(miliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, miliseconds))
    }

    // Errors

    static assertValue(valueObject: any): void {
        const name = Object.keys(valueObject)[0]
        const value = valueObject[name]
        if (!value) {
            Utils.logError(`ASSERT VALUE [${name}]`)
        }
    }

    static assert(condition: any, tag = ''): void {
        /// #!if ENV !== "production"
        if (!condition) {
            Utils.logError(`ASSERT [${tag ?? new Error().stack}]`)
        }

        /// #!endif
    }

    static assertFailure(tag = ''): void {
        /// #!if ENV !== "production"
        Utils.assert(false, tag)

        /// #!endif
    }

    static log(message: string): void {
        /// #!if ENV !== "production"
        const timestamp = (Date.now() / 1000).toFixed(2)
        // eslint-disable-next-line no-console
        console.log(`[${timestamp}] ${message}`)

        /// #!endif
    }

    static logError(message: string): void {
        /// #!if ENV !== "production"
        const timestamp = (Date.now() / 1000).toFixed(2)
        // eslint-disable-next-line no-console
        console.error(`[${timestamp}] ${message}`)

        /// #!endif
    }

    static logWarn(message: string): void {
        /// #!if ENV !== "production"
        const timestamp = (Date.now() / 1000).toFixed(2)
        // eslint-disable-next-line no-console
        console.warn(`[${timestamp}] ${message}`)

        /// #!endif
    }

    // URL

    static replaceUrlQueryParam(paramName: string, value?: string): void {
        const queryString = new URLSearchParams(window.location.search)
        const currentValue = queryString.get(paramName) || ''
        if (currentValue !== value) {
            const newUrl = new URL(window.location.toString())
            if (value) {
                newUrl.searchParams.set(paramName, value)
            } else {
                newUrl.searchParams.delete(paramName)
            }
            window.history.pushState({}, document.title, newUrl.toString())
        }
    }

    static ensureProtocol(url: string): string {
        return url.match(/^.+:\/\//) ? url : `https://${url}`
    }

    // File names

    static sanitizeFilename(filename: string): string {
        // TODO: Use an industrial-strength sanitizer
        let sanitizedFilename = filename
        const illegalCharacters = ['\\', '/', '?', ':', '<', '>', '*', '|', '"', '.']
        illegalCharacters.forEach((character) => {
            sanitizedFilename = sanitizedFilename.replace(character, '')
        })

        return sanitizedFilename
    }

    // File picker

    static selectLocalFile(onSelect?: (file: File) => void, accept = '.jpg,.jpeg,.png'): void {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.onchange = async () => {
            const file = input.files![0]
            onSelect?.(file)
        }

        input.style.display = 'none'
        document.body.appendChild(input)
        input.click()

        // TODO: Remove or reuse input
    }

    // Arrays

    static arraysEqual(a: readonly any[], b: readonly any[]): boolean {
        if (a === b) {
            return true
        }
        if (a === null || b === null) {
            return false
        }
        if (a === undefined || b === undefined) {
            return false
        }
        if (a.length !== b.length) {
            return false
        }

        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) {
                return false
            }
        }

        return true
    }

    static arrayMove(arr: any[], srcIndex: number, destIndex: number): void {
        arr.splice(destIndex, 0, arr.splice(srcIndex, 1)[0])
    }

    // Clipboard

    static copyTextToClipboard(text: string): boolean {
        const textField = document.createElement('textarea')
        textField.innerText = text
        textField.style.position = 'fixed'
        textField.style.opacity = '0'

        document.body.appendChild(textField)
        textField.select()

        let result = false
        try {
            result = document.execCommand('copy')
        } catch (err) {
            Utils.logError(`copyTextToClipboard ERROR: ${err}`)
            result = false
        }
        textField.remove()

        return result
    }

    static isMobile(): boolean {
        const toMatch = [
            /Android/i,
            /webOS/i,
            /iPhone/i,
            /iPad/i,
            /iPod/i,
            /BlackBerry/i,
            /Windows Phone/i,
        ]

        return toMatch.some((toMatchItem) => {
            return navigator.userAgent.match(toMatchItem)
        })
    }

    static getBaseURL(absolute?: boolean): string {
        let baseURL = window.baseURL || ''
        baseURL = baseURL.replace(/\/+$/, '')
        if (baseURL.indexOf('/') === 0) {
            baseURL = baseURL.slice(1)
        }
        if (absolute) {
            return window.location.origin + '/' + baseURL
        }

        return baseURL
    }

    static getFrontendBaseURL(absolute?: boolean): string {
        let frontendBaseURL = window.frontendBaseURL || Utils.getBaseURL()
        frontendBaseURL = frontendBaseURL.replace(/\/+$/, '')
        if (frontendBaseURL.indexOf('/') === 0) {
            frontendBaseURL = frontendBaseURL.slice(1)
        }
        if (absolute) {
            return window.location.origin + '/' + frontendBaseURL
        }

        return frontendBaseURL
    }

    static roundTo(num: number, decimalPlaces: number): number {
        return Math.round(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
    }

    static fixWSData(message: WSMessage): [WSMessagePayloads, ChangeHandlerType] {
        if (message.block) {
            return [this.fixBlock(message.block), 'block']
        } else if (message.board) {
            return [this.fixBoard(message.board), 'board']
        } else if (message.category) {
            return [message.category, 'category']
        } else if (message.blockCategories) {
            return [message.blockCategories, 'blockCategories']
        } else if (message.member) {
            return [message.member, 'boardMembers']
        } else if (message.categoryOrder) {
            return [message.categoryOrder, 'categoryOrder']
        }

        return [null, 'block']
    }

    static fixBlock(block: Block): Block {
        switch (block.type) {
        case 'view':
            return createBoardView(block)
        case 'card':
            return createCard(block)
        case 'comment':
            return createCommentBlock(block)
        default:
            return block
        }
    }

    static fixBoard(board: BoardType): BoardType {
        return createBoard(board)
    }

    static userAgent(): string {
        return window.navigator.userAgent
    }

    static isDesktopApp(): boolean {
        return Utils.userAgent().indexOf('Mattermost') !== -1 && Utils.userAgent().indexOf('Electron') !== -1
    }

    static getDesktopVersion(): string {
        // use if the value window.desktop.version is not set yet
        const regex = /Mattermost\/(\d+\.\d+\.\d+)/gm
        const match = regex.exec(window.navigator.appVersion)?.[1] || ''

        return match
    }

    /**
     * Function to check how a version compares to another
     *
     * eg.  versionA = 4.16.0, versionB = 4.17.0 returns  1
     *      versionA = 4.16.1, versionB = 4.16.1 returns  0
     *      versionA = 4.16.1, versionB = 4.15.0 returns -1
     */
    static compareVersions(versionA: string, versionB: string): number {
        if (versionA === versionB) {
            return 0
        }

        // We only care about the numbers
        const versionANumber = (versionA || '').split('.').filter((x) => (/^[0-9]+$/).exec(x) !== null)
        const versionBNumber = (versionB || '').split('.').filter((x) => (/^[0-9]+$/).exec(x) !== null)

        for (let i = 0; i < Math.max(versionANumber.length, versionBNumber.length); i++) {
            const a = parseInt(versionANumber[i], 10) || 0
            const b = parseInt(versionBNumber[i], 10) || 0
            if (a > b) {
                return -1
            }

            if (a < b) {
                return 1
            }
        }

        // If all components are equal, then return true
        return 0
    }

    static isDesktop(): boolean {
        return Utils.isDesktopApp() && (Utils.compareVersions(Utils.getDesktopVersion(), '5.0.0') <= 0)
    }

    static getReadToken(): string {
        const queryString = new URLSearchParams(window.location.search)
        const readToken = queryString.get('r') || ''

        return readToken
    }

    static generateClassName(conditions: Record<string, boolean>): string {
        return Object.entries(conditions).map(([className, condition]) => (condition ? className : '')).filter((className) => className !== '').join(' ')
    }

    static buildOriginalPath(teamID = '', boardId = '', viewId = '', cardId = ''): string {
        let originalPath = ''

        if (teamID) {
            originalPath += `${teamID}/`
        }

        if (boardId) {
            originalPath += `${boardId}/`
        }

        if (viewId) {
            originalPath += `${viewId}/`
        }

        if (cardId) {
            originalPath += `${cardId}/`
        }

        return originalPath
    }

    static uuid(): string {
        return (window as any).URL.createObjectURL(new Blob([])).substr(-36)
    }

    static isKeyPressed(event: KeyboardEvent, key: [string, number]): boolean {
        // There are two types of keyboards
        // 1. English with different layouts(Ex: Dvorak)
        // 2. Different language keyboards(Ex: Russian)
        if (event.keyCode === KeyCodes.COMPOSING[1]) {
            return false
        }

        // checks for event.key for older browsers and also for the case of different English layout keyboards.
        if (typeof event.key !== 'undefined' && event.key !== 'Unidentified' && event.key !== 'Dead') {
            const isPressedByCode = event.key === key[0] || event.key === key[0].toUpperCase()
            if (isPressedByCode) {
                return true
            }
        }

        // used for different language keyboards to detect the position of keys
        return event.keyCode === key[1]
    }

    static isMac() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0
    }

    static cmdOrCtrlPressed(e: KeyboardEvent, allowAlt = false) {
        if (allowAlt) {
            return (Utils.isMac() && e.metaKey) || (!Utils.isMac() && e.ctrlKey)
        }

        return (Utils.isMac() && e.metaKey) || (!Utils.isMac() && e.ctrlKey && !e.altKey)
    }

    static getBoardPagePath(currentPath: string) {
        if (currentPath === '/team/:teamId/new/:channelId') {
            return '/team/:teamId/:boardId?/:viewId?/:cardId?'
        }

        return currentPath
    }

    static showBoard(
        boardId: string,
        match: routerMatch<{boardId: string, viewId?: string, cardId?: string, teamId?: string}>,
        history: History,
    ) {
        // if the same board, reuse the match params
        // otherwise remove viewId and cardId, results in first view being selected
        const params = {...match.params, boardId: boardId || ''}
        if (boardId !== match.params.boardId) {
            params.viewId = undefined
            params.cardId = undefined
        }
        const newPath = generatePath(Utils.getBoardPagePath(match.path), params)
        history.push(newPath)
    }

    static humanFileSize(bytesParam: number, si = false, dp = 1): string {
        let bytes = bytesParam
        const thresh = si ? 1000 : 1024

        if (Math.abs(bytes) < thresh) {
            return bytes + ' B'
        }

        const units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
        let u = -1
        const r = 10 ** dp

        do {
            bytes /= thresh
            ++u
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1)

        return bytes.toFixed(dp) + ' ' + units[u]
    }

    static spaceSeparatedStringIncludes(item: string, spaceSeparated?: string): boolean {
        if (spaceSeparated) {
            const items = spaceSeparated?.split(' ')

            return items.includes(item)
        }

        return false
    }

    static isSystemAdmin(roles: string): boolean {
        return Utils.spaceSeparatedStringIncludes(SYSTEM_ADMIN_ROLE, roles)
    }

    static isTeamAdmin(roles: string): boolean {
        return Utils.spaceSeparatedStringIncludes(TEAM_ADMIN_ROLE, roles)
    }

    static isAdmin(roles: string): boolean {
        return Utils.isSystemAdmin(roles) || Utils.isTeamAdmin(roles)
    }
}

export {Utils, IDType}
