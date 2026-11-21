// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Flows: short sequences on the generated page objects that many specs share. They act and wait for elements
// (`locator.waitFor()`); specs assert.

export {calendarDayKey, monthDays, pickDate, showMonth, type Calendar} from './calendar';
export {setCelExpression} from './access_control';
export {removeChip} from './chips';
export {comboboxChips, removeComboboxChip} from './combobox_chips';
export {openChannel} from './channels';
export {createChannelFromModal, openNewChannelModal} from './new_channel';
export {lastPost, postsOf, postWith, type PostList} from './posts';
export {closeTeamSettings, openChannelSettings, openTeamSettings} from './settings';
export {openSystemConsoleSection, openSystemUsers, searchSystemUsers, systemConsolePath} from './system_console';

export * from './attributes';

export {
    expectLoginHeading,
    logIn,
    logInWithKeycloak,
    openLogin,
    openSignedOut,
    loginPageUrl,
    signedInUrl,
} from './auth';
