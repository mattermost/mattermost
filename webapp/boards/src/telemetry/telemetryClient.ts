// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IUser} from 'src/user'

import {TelemetryHandler} from './telemetry'

export const TelemetryCategory = 'boards'

export const TelemetryActions = {
    ClickChannelHeader: 'clickChannelHeader',
    ClickChannelIntro: 'channelIntro_boardLink',
    ViewBoard: 'viewBoard',
    CreateBoard: 'createBoard',
    DuplicateBoard: 'duplicateBoard',
    DeleteBoard: 'deleteBoard',
    DeleteBoardTemplate: 'deleteBoardTemplate',
    ShareBoard: 'shareBoard',
    CreateBoardTemplate: 'createBoardTemplate',
    CreateBoardViaTemplate: 'createBoardViaTemplate',
    AddTemplateFromBoard: 'AddTemplateFromBoard',
    CreateBoardView: 'createBoardView',
    DuplicateBoardView: 'duplicagteBoardView',
    DeleteBoardView: 'deleteBoardView',
    EditCardProperty: 'editCardProperty',
    ViewCard: 'viewCard',
    CreateCard: 'createCard',
    CreateCardTemplate: 'createCardTemplate',
    CreateCardViaTemplate: 'createCardViaTemplate',
    DuplicateCard: 'duplicateCard',
    DeleteCard: 'deleteCard',
    AddTemplateFromCard: 'addTemplateFromCard',
    ViewSharedBoard: 'viewSharedBoard',
    ShareBoardOpenModal: 'shareBoard_openModal',
    ShareBoardLogin: 'shareBoard_login',
    ShareLinkPublicCopy: 'shareLinkPublic_copy',
    ShareLinkInternalCopy: 'shareLinkInternal_copy',
    ImportArchive: 'settings_importArchive',
    ImportTrello: 'settings_importTrello',
    ImportAsana: 'settings_importAsana',
    ImportNotion: 'settings_importNotion',
    ImportJira: 'settings_importJira',
    ImportTodoist: 'settings_importTodoist',
    ExportArchive: 'settings_exportArchive',
    StartTour: 'welcomeScreen_startTour',
    SkipTour: 'welcomeScreen_skipTour',
    CloudMoreInfo: 'cloud_more_info',
    ViewLimitReached: 'limit_ViewLimitReached',
    ViewLimitCTAPerformed: 'limit_ViewLimitLinkOpen',
    LimitCardCTAPerformed: 'limit_CardLimitCTAPerformed',
    LimitCardLimitReached: 'limit_cardLimitReached',
    LimitCardLimitLinkOpen: 'limit_cardLimitLinkOpen',
    VersionMoreInfo: 'version_more_info',
    ClickChannelsRHSBoard: 'click_board_in_channels_RHS',
}

interface IEventProps {
    channelID?: string
    teamID?: string
    board?: string
    view?: string
    viewType?: string
    card?: string
    cardTemplateId?: string
    boardTemplateId?: string
    shareBoardEnabled?: boolean
}

class TelemetryClient {
    public telemetryHandler?: TelemetryHandler
    public user?: IUser

    setTelemetryHandler(telemetryHandler?: TelemetryHandler): void {
        this.telemetryHandler = telemetryHandler
    }

    setUser(user: IUser): void {
        this.user = user
    }

    trackEvent(category: string, event: string, props?: IEventProps): void {
        if (this.telemetryHandler) {
            const userId = this.user?.id
            this.telemetryHandler.trackEvent(userId || '', '', category, event, props)
        }
    }

    pageVisited(category: string, name: string): void {
        if (this.telemetryHandler) {
            const userId = this.user?.id
            this.telemetryHandler.pageVisited(userId || '', '', category, name)
        }
    }
}

const telemetryClient = new TelemetryClient()

export {TelemetryClient}
export default telemetryClient
