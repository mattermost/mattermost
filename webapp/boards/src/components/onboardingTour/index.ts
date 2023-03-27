// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
export const BaseTourSteps = {
    OPEN_A_CARD: 0,
}

export const CardTourSteps = {
    ADD_PROPERTIES: 0,
    ADD_COMMENTS: 1,
    ADD_DESCRIPTION: 2,
}

export const BoardTourSteps: {[key: string]: number} = {
    ADD_VIEW: 0,
    COPY_LINK: 1,
    SHARE_BOARD: 2,
}

export const SidebarTourSteps: {[key: string]: number} = {
    SIDE_BAR: 0,
    MANAGE_CATEGORIES: 1,
    SEARCH_FOR_BOARDS: 2,
}

export const FINISHED = 999

export const TOUR_BASE = 'onboarding'
export const TOUR_CARD = 'card'
export const TOUR_BOARD = 'board'
export const TOUR_SIDEBAR = 'sidebar'

export const TOUR_ORDER = [
    TOUR_BASE,
    TOUR_CARD,
    TOUR_BOARD,
    TOUR_SIDEBAR,
]

export const TourCategoriesMapToSteps: Record<string, Record<string, number>> = {
    [TOUR_BASE]: BaseTourSteps,
    [TOUR_CARD]: CardTourSteps,
    [TOUR_BOARD]: BoardTourSteps,
    [TOUR_SIDEBAR]: SidebarTourSteps,
}
