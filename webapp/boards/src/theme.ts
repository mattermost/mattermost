// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CSSObject} from '@emotion/serialize'
import isEqual from 'lodash/isEqual'
import color from 'color'

let activeThemeName: string

import {UserSettings} from './userSettings'

export type Theme = {
    mainBg: string
    mainFg: string
    buttonBg: string
    buttonFg: string
    sidebarBg: string
    sidebarFg: string
    sidebarTextActiveBorder: string
    sidebarWhiteLogo: string

    link: string
    linkVisited: string

    propDefault: string
    propGray: string
    propBrown: string
    propOrange: string
    propYellow: string
    propGreen: string
    propBlue: string
    propPurple: string
    propPink: string
    propRed: string
}

export const systemThemeName = 'system-theme'

export const defaultThemeName = 'default-theme'

export const defaultTheme = {
    mainBg: '255, 255, 255',
    mainFg: '63, 67, 80',
    buttonBg: '28, 88, 217',
    buttonFg: '255, 255, 255',
    sidebarBg: '30, 50, 92',
    sidebarFg: '255, 255, 255',
    sidebarTextActiveBorder: '93, 137, 243',
    sidebarWhiteLogo: 'true',

    link: '93, 137, 234',
    linkVisited: '#551a8b',

    propDefault: '#fff',
    propGray: '#EDEDED',
    propBrown: '#F7DDC3',
    propOrange: '#ffd3c1',
    propYellow: '#f7f0b6',
    propGreen: '#c7eac3',
    propBlue: '#B1D1F6',
    propPurple: '#e6d0ff',
    propPink: '#ffd6e9',
    propRed: '#ffa9a9',
}

export const darkThemeName = 'dark-theme'

export const darkTheme = {
    ...defaultTheme,

    mainBg: '55, 53, 47',
    mainFg: '220, 220, 220',
    buttonBg: '80, 170, 221',
    buttonFg: '255, 255, 255',
    sidebarBg: '75, 73, 67',
    sidebarFg: '255, 255, 255',
    sidebarTextActiveBorder: '102, 185, 167',
    sidebarWhiteLogo: 'true',

    link: '#0090ff',
    linkVisited: 'hsla(270, 68%, 70%, 1.0)',

    propDefault: 'hsla(0, 100%, 100%, 0.08)',
    propGray: 'hsla(0, 0%, 70%, 0.4)',
    propBrown: 'hsla(25, 60%, 40%, 0.4)',
    propOrange: 'hsla(35, 100%, 50%, 0.4)',
    propYellow: 'hsla(48, 100%, 70%, 0.4)',
    propGreen: 'hsla(120, 100%, 70%, 0.4)',
    propBlue: 'hsla(240, 100%, 70%, 0.4)',
    propPurple: 'hsla(270, 100%, 64%, 0.4)',
    propPink: 'hsla(310, 100%, 80%, 0.4)',
    propRed: 'hsla(4, 100%, 70%, 0.4)',
}

export const lightThemeName = 'light-theme'

export const lightTheme = {
    ...defaultTheme,

    mainBg: '255, 255, 255',
    mainFg: '55, 53, 47',
    buttonBg: '80, 170, 221',
    buttonFg: '255, 255, 255',
    sidebarBg: '247, 246, 243',
    sidebarFg: '55, 53, 47',
    sidebarTextActiveBorder: '87, 158, 255',
    sidebarWhiteLogo: 'false',
}

export function setTheme(theme: Theme | null): Theme {
    let consolidatedTheme = defaultTheme
    if (theme) {
        consolidatedTheme = {...defaultTheme, ...theme}
        UserSettings.theme = JSON.stringify(consolidatedTheme)
    } else {
        UserSettings.theme = ''
        const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
        if (darkThemeMq.matches) {
            consolidatedTheme = {...defaultTheme, ...darkTheme}
        }
    }

    setActiveThemeName(consolidatedTheme, theme)

    // Focalboard reuses Mattermost's color pallet, so we don't really need to
    // set the color variables here because in the app, Mattermost webapp would have already
    // declared them.
    // But,
    // when testing the plugin mode in Jest unit test,
    // since there is no Mattermost webapp, we need to ensure someone declares the variables.
    // So here we set the variable if it wasn't already declared.
    // In plugins, since Mattermost webapp renders always before the plugin/product,
    // the variables are guaranteed to be set there.
    //
    // Fun fact - in a Jest test suite, if there are some non-plugin tests and a few plugin tests,
    // if a non-plugin test ran first, it creates the variables in document, which is somehow
    // shared to other tests as well. That's why the tests don't fail unless you run ONLY
    // a plugin test.

    const style = document.documentElement.style

    style.setProperty('--center-channel-bg-rgb', style.getPropertyValue('--center-channel-bg-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--center-channel-color-rgb', style.getPropertyValue('--center-channel-color-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--button-bg-rgb', style.getPropertyValue('--button-bg-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--button-color-rgb', style.getPropertyValue('--button-color-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--sidebar-bg-rgb', style.getPropertyValue('--sidebar-bg-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--sidebar-text-rgb', style.getPropertyValue('--sidebar-text-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--link-color-rgb', style.getPropertyValue('--link-color-rgb') || consolidatedTheme.mainBg)
    style.setProperty('--sidebar-text-active-border-rgb', style.getPropertyValue('--sidebar-text-active-border-rgb') || consolidatedTheme.mainBg)

    document.documentElement.style.setProperty('--sidebar-white-logo', consolidatedTheme.sidebarWhiteLogo)
    document.documentElement.style.setProperty('--link-visited-color-rgb', consolidatedTheme.linkVisited)

    const mainBgColor = color(`rgb(${getComputedStyle(document.documentElement).getPropertyValue('--center-channel-bg-rgb')})`)

    let fixedTheme = lightTheme
    if (mainBgColor.isDark()) {
        fixedTheme = darkTheme
    }
    consolidatedTheme.propDefault = fixedTheme.propDefault
    consolidatedTheme.propGray = fixedTheme.propGray
    consolidatedTheme.propBrown = fixedTheme.propBrown
    consolidatedTheme.propOrange = fixedTheme.propOrange
    consolidatedTheme.propYellow = fixedTheme.propYellow
    consolidatedTheme.propGreen = fixedTheme.propGreen
    consolidatedTheme.propBlue = fixedTheme.propBlue
    consolidatedTheme.propPurple = fixedTheme.propPurple
    consolidatedTheme.propPink = fixedTheme.propPink
    consolidatedTheme.propRed = fixedTheme.propRed

    document.documentElement.style.setProperty('--prop-default', consolidatedTheme.propDefault)
    document.documentElement.style.setProperty('--prop-gray', consolidatedTheme.propGray)
    document.documentElement.style.setProperty('--prop-brown', consolidatedTheme.propBrown)
    document.documentElement.style.setProperty('--prop-orange', consolidatedTheme.propOrange)
    document.documentElement.style.setProperty('--prop-yellow', consolidatedTheme.propYellow)
    document.documentElement.style.setProperty('--prop-green', consolidatedTheme.propGreen)
    document.documentElement.style.setProperty('--prop-blue', consolidatedTheme.propBlue)
    document.documentElement.style.setProperty('--prop-purple', consolidatedTheme.propPurple)
    document.documentElement.style.setProperty('--prop-pink', consolidatedTheme.propPink)
    document.documentElement.style.setProperty('--prop-red', consolidatedTheme.propRed)

    return consolidatedTheme
}

export function setMattermostTheme(theme: any): Theme {
    if (!theme) {
        return setTheme(defaultTheme)
    }

    document.documentElement.style.setProperty('--center-channel-bg-rgb', color(theme.centerChannelBg).rgb().array().join(', '))
    document.documentElement.style.setProperty('--center-channel-color-rgb', color(theme.centerChannelColor).rgb().array().join(', '))
    document.documentElement.style.setProperty('--button-bg-rgb', color(theme.buttonBg).rgb().array().join(', '))
    document.documentElement.style.setProperty('--button-color-rgb', color(theme.buttonColor).rgb().array().join(', '))
    document.documentElement.style.setProperty('--sidebar-bg-rgb', color(theme.sidebarBg).rgb().array().join(', '))
    document.documentElement.style.setProperty('--sidebar-text-rgb', color(theme.sidebarText).rgb().array().join(', '))
    document.documentElement.style.setProperty('--link-color-rgb', theme.linkColor)
    document.documentElement.style.setProperty('--sidebar-text-active-border-rgb', color(theme.sidebarTextActiveBorder).rgb().array().join(', '))

    return setTheme({
        ...defaultTheme,
        mainBg: color(theme.centerChannelBg).rgb().array().join(', '),
        mainFg: color(theme.centerChannelColor).rgb().array().join(', '),
        buttonBg: color(theme.buttonBg).rgb().array().join(', '),
        buttonFg: color(theme.buttonColor).rgb().array().join(', '),
        sidebarBg: color(theme.sidebarBg).rgb().array().join(', '),
        sidebarFg: color(theme.sidebarColor || '#ffffff').rgb().array().join(', '),
        sidebarTextActiveBorder: color(theme.sidebarTextActiveBorder).rgb().array().join(', '),
        link: theme.linkColor,
    })
}

function setActiveThemeName(consolidatedTheme: Theme, theme: Theme | null) {
    if (theme === null) {
        activeThemeName = systemThemeName
    } else if (isEqual(consolidatedTheme, darkTheme)) {
        activeThemeName = darkThemeName
    } else if (isEqual(consolidatedTheme, lightTheme)) {
        activeThemeName = lightThemeName
    } else {
        activeThemeName = defaultThemeName
    }
}

export function loadTheme(): Theme {
    const themeStr = UserSettings.theme
    if (themeStr) {
        try {
            const theme = JSON.parse(themeStr)
            const consolidatedTheme = setTheme(theme)
            setActiveThemeName(consolidatedTheme, theme)
            return consolidatedTheme
        } catch (e) {
            return setTheme(null)
        }
    } else {
        return setTheme(null)
    }
}

export function initThemes(): void {
    const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
    const changeHandler = () => {
        const themeStr = UserSettings.theme
        if (!themeStr) {
            setTheme(null)
        }
    }
    if (darkThemeMq.addEventListener) {
        darkThemeMq.addEventListener('change', changeHandler)
    } else if (darkThemeMq.addListener) {
        // Safari and Mac app support
        darkThemeMq.addListener(changeHandler)
    }
    loadTheme()
}

export function getSelectBaseStyle() {
    return {
        dropdownIndicator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none !important',
        }),
        indicatorSeparator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none',
        }),
        loadingIndicator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none',
        }),
        clearIndicator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none',
        }),
        menu: (provided: CSSObject): CSSObject => ({
            ...provided,
            width: 'unset',
            background: 'rgb(var(--center-channel-bg-rgb))',
        }),
        option: (provided: CSSObject, state: { isFocused: boolean }): CSSObject => ({
            ...provided,
            background: state.isFocused ? 'rgba(var(--center-channel-color-rgb), 0.1)' : 'rgb(var(--center-channel-bg-rgb))',
            color: state.isFocused ? 'rgb(var(--center-channel-color-rgb))' : 'rgb(var(--center-channel-color-rgb))',
            padding: '2px 8px',
        }),
        control: (): CSSObject => ({
            border: 0,
            width: '100%',
            margin: '4px 0 0 0',

            // display: 'flex',
            // marginTop: 0,
        }),
        valueContainer: (provided: CSSObject): CSSObject => ({
            ...provided,
            padding: '0 5px',
            overflow: 'unset',
        }),
        singleValue: (provided: CSSObject): CSSObject => ({
            ...provided,
            color: 'rgb(var(--center-channel-color-rgb))',
            overflow: 'unset',
            maxWidth: 'calc(100% - 20px)',
        }),
        input: (provided: CSSObject): CSSObject => ({
            ...provided,
            paddingBottom: 0,
            paddingTop: 0,
            marginBottom: 0,
            marginTop: 0,
        }),
        menuList: (provided: CSSObject): CSSObject => ({
            ...provided,
            overflowY: 'auto',
            overflowX: 'hidden',
        }),
    }
}

export function getActiveThemeName(): string {
    return activeThemeName || defaultThemeName
}
