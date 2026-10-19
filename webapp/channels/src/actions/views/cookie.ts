// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function clearUserCookie() {
    // We need to clear the cookie without the domain, with the domain, and with both the domain and path set because we
    // can't tell if the server set the cookie with or without the domain.
    // The server will have set the domain if ServiceSettings.EnableCookiesForSubdomains is true
    // The server will have set a non-default path if Mattermost is also served from a subpath.
    document.cookie = 'MMUSERID=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
    document.cookie = `MMUSERID=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=${window.basename}`;
    document.cookie = `MMUSERID=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=${window.location.hostname};path=/`;
    document.cookie = `MMUSERID=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=${window.location.hostname};path=${window.basename}`;
    document.cookie = 'MMCSRF=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
    document.cookie = `MMCSRF=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=${window.basename}`;
    document.cookie = `MMCSRF=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=${window.location.hostname};path=/`;
    document.cookie = `MMCSRF=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=${window.location.hostname};path=${window.basename}`;
}
