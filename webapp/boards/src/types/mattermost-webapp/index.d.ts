// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react'

import type {Channel, ChannelMembership} from '@mattermost/types/channels'

type ReactResolvable = React.ReactNode | React.ElementType

export interface PluginRegistry {
    registerTranslations(getTranslationsForLocale: (locale: string) => Record<string, string>): void
    registerPostTypeComponent(typeName: string, component: ReactResolvable): any
    registerChannelHeaderButtonAction(icon: ReactResolvable, action: () => void, dropdownText: string, tooltipText: string): any
    registerChannelIntroButtonAction(icon: ReactResolvable, action: () => void, tooltipText: ReactResolvable): any
    registerCustomRoute(route: string, component: ReactResolvable): any
    registerProductRoute(route: string, component: ReactResolvable): any
    unregisterComponent(componentId: string): any
    registerProduct(baseURL: string, switcherIcon: string, switcherText: string, switcherLinkURL: string,
        mainComponent: ReactResolvable, headerCentreComponent: ReactResolvable, headerRightComponent: ReactResolvable,
        showTeamSidebar: boolean, showAppBar: boolean, wrapped: boolean, publicComponent: ReactResolvable | null): any
    registerPostWillRenderEmbedComponent(match: (embed: {type: string, data: any}) => void, component: any, toggleable: boolean): any
    registerWebSocketEventHandler(event: string, handler: (e: any) => void): any
    unregisterWebSocketEventHandler(event: string): any
    registerAppBarComponent(iconURL: string, action: (channel: Channel, member: ChannelMembership) => void, tooltipText: React.ReactNode): any
    registerRightHandSidebarComponent(component: ReactResolvable, title: ReactResolvable): any
    registerRootComponent(component: ReactResolvable): any
    registerInsightsHandler(handler: (timeRange: string, page: number, perPage: number, teamId: string, insightType: string) => void): any
    registerSiteStatisticsHandler(handler: () => void): any

    registerActionAfterChannelCreation(component: ReactResolvable): any

    // Add more if needed from https://developers.mattermost.com/extend/plugins/webapp/reference
}
