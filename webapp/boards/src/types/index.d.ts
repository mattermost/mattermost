// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type TelemetryProps = {
    trackingLocation: string
}
export interface IAppWindow extends Window {
    baseURL?: string
    frontendBaseURL?: string
    getCurrentTeamId?: () => string
    msCrypto: Crypto
    openInNewBrowser?: ((href: string) => void) | null
    webkit?: {messageHandlers: {nativeApp?: {postMessage: <T>(message: T) => void}}}
    openPricingModal?: () => (telemetry: TelemetryProps) => void
}

// SuiteWindow documents all custom properties
// which may be defined on global
// window object when operating in
// the Mattermost suite environment
export type SuiteWindow = Window & {
    getCurrentTeamId?: () => string
    baseURL?: string
    frontendBaseURL?: string
    WebappUtils?: any
}
