// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IAppWindow} from './types'
import {exportUserSettingsBlob, importUserSettingsBlob} from './userSettings'

declare interface INativeApp {
    settingsBlob: string | null
}

declare const NativeApp: INativeApp
declare let window: IAppWindow

export function importNativeAppSettings(): void {
    if (typeof NativeApp === 'undefined' || !NativeApp.settingsBlob) {
        return
    }
    const importedKeys = importUserSettingsBlob(NativeApp.settingsBlob)
    const messageType = importedKeys.length ? 'didImportUserSettings' : 'didNotImportUserSettings'
    postWebKitMessage({type: messageType, settingsBlob: exportUserSettingsBlob(), keys: importedKeys})
    NativeApp.settingsBlob = null
}

export function notifySettingsChanged(key: string): void {
    postWebKitMessage({type: 'didChangeUserSettings', settingsBlob: exportUserSettingsBlob(), key})
}

function postWebKitMessage<T>(message: T) {
    window.webkit?.messageHandlers.nativeApp?.postMessage(message)
}
