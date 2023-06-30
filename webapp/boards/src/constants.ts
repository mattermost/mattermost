// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TelemetryActions} from './telemetry/telemetryClient'

enum Permission {
    ManageBoardType = 'manage_board_type',
    DeleteBoard = 'delete_board',
    ShareBoard = 'share_board',
    ManageBoardRoles = 'manage_board_roles',
    ChannelCreatePost = 'create_post',
    ManageBoardCards = 'manage_board_cards',
    ManageBoardProperties = 'manage_board_properties',
    CommentBoardCards = 'comment_board_cards',
    ViewBoard = 'view_board',
    DeleteOthersComments = 'delete_others_comments'
}

class Constants {
    static readonly menuColors: {[key: string]: string} = {
        propColorDefault: 'Default',
        propColorGray: 'Gray',
        propColorBrown: 'Brown',
        propColorOrange: 'Orange',
        propColorYellow: 'Yellow',
        propColorGreen: 'Green',
        propColorBlue: 'Blue',
        propColorPurple: 'Purple',
        propColorPink: 'Pink',
        propColorRed: 'Red',
    }

    static readonly minColumnWidth = 100
    static readonly defaultTitleColumnWidth = 280
    static readonly tableHeaderId = '__header'
    static readonly tableCalculationId = '__calculation'
    static readonly titleColumnId = '__title'
    static readonly badgesColumnId = '__badges'

    static readonly versionString = '7.10.0'
    static readonly versionDisplayString = 'Apr 2023'

    static readonly archiveHelpPage = 'https://docs.mattermost.com/boards/migrate-to-boards.html'
    static readonly imports = [
        {
            id: 'trello',
            displayName: 'Trello',
            telemetryName: TelemetryActions.ImportTrello,
            href: Constants.archiveHelpPage + '#import-from-trello',
        },
        {
            id: 'asana',
            displayName: 'Asana',
            telemetryName: TelemetryActions.ImportAsana,
            href: Constants.archiveHelpPage + '#import-from-asana',
        },
        {
            id: 'notion',
            displayName: 'Notion',
            telemetryName: TelemetryActions.ImportNotion,
            href: Constants.archiveHelpPage + '#import-from-notion',
        },
        {
            id: 'jira',
            displayName: 'Jira',
            telemetryName: TelemetryActions.ImportJira,
            href: Constants.archiveHelpPage + '#import-from-jira',
        },
        {
            id: 'todoist',
            displayName: 'Todoist',
            telemetryName: TelemetryActions.ImportTodoist,
            href: Constants.archiveHelpPage + '#import-from-todoist',
        },
    ]

    static readonly languages = [
        {
            code: 'en',
            name: 'english',
            displayName: 'English',
        },
        {
            code: 'es',
            name: 'spanish',
            displayName: 'Español',
        },
        {
            code: 'de',
            name: 'german',
            displayName: 'Deutsch',
        },
        {
            code: 'ja',
            name: 'japanese',
            displayName: '日本語',
        },
        {
            code: 'fr',
            name: 'french',
            displayName: 'Français',
        },
        {
            code: 'nl',
            name: 'dutch',
            displayName: 'Nederlands',
        },
        {
            code: 'ru',
            name: 'russian',
            displayName: 'Pусский',
        },
        {
            code: 'zh-cn',
            name: 'chinese',
            displayName: '中文 (繁體)',
        },
        {
            code: 'zh-tw',
            name: 'simplified-chinese',
            displayName: '中文 (简体)',
        },
        {
            code: 'tr',
            name: 'turkish',
            displayName: 'Türkçe',
        },
        {
            code: 'oc',
            name: 'occitan',
            displayName: 'Occitan',
        },
        {
            code: 'pt-br',
            name: 'portuguese',
            displayName: 'Português (Brasil)',
        },
        {
            code: 'ca',
            name: 'catalan',
            displayName: 'Català',
        },
        {
            code: 'el',
            name: 'greek',
            displayName: 'Ελληνικά',
        },
        {
            code: 'id',
            name: 'indonesian',
            displayName: 'bahasa Indonesia',
        },
        {
            code: 'it',
            name: 'italian',
            displayName: 'Italiano',
        },
        {
            code: 'sv',
            name: 'swedish',
            displayName: 'Svenska',
        },
    ]

    static readonly keyCodes: {[key: string]: [string, number]} = {
        COMPOSING: ['Composing', 229],
        ESC: ['Esc', 27],
        UP: ['Up', 38],
        DOWN: ['Down', 40],
        ENTER: ['Enter', 13],
        A: ['a', 65],
        B: ['b', 66],
        C: ['c', 67],
        D: ['d', 68],
        E: ['e', 69],
        F: ['f', 70],
        G: ['g', 71],
        H: ['h', 72],
        I: ['i', 73],
        J: ['j', 74],
        K: ['k', 75],
        L: ['l', 76],
        M: ['m', 77],
        N: ['n', 78],
        O: ['o', 79],
        P: ['p', 80],
        Q: ['q', 81],
        R: ['r', 82],
        S: ['s', 83],
        T: ['t', 84],
        U: ['u', 85],
        V: ['v', 86],
        W: ['w', 87],
        X: ['x', 88],
        Y: ['y', 89],
        Z: ['z', 90],
    }

    static readonly globalTeamId = '0'
    static readonly noChannelID = '0'

    static readonly myInsights = 'MY'

    static readonly SystemUserID = 'system'
}

export const CloudLinks = {
    PRICING: 'https://mattermost.com/pl/pricing/',
}

export {Constants, Permission}
