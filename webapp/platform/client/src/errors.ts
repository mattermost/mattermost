// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Given a URL from an API request, return a URL that has any parts removed that are either sensitive or that would
// prevent properly grouping the messages in Sentry.
export function cleanUrlForLogging(baseUrl: string, apiUrl: string): string {
    let url = apiUrl;

    // Trim the host name
    url = url.substring(baseUrl.length);

    // Filter the query string
    const index = url.indexOf('?');
    if (index !== -1) {
        url = url.substring(0, index);
    }

    // A non-exhaustive whitelist to exclude parts of the URL that are unimportant (eg IDs) or may be sentsitive
    // (eg email addresses). We prefer filtering out fields that aren't recognized because there should generally
    // be enough left over for debugging.
    //
    // Note that new API routes don't need to be added here since this shouldn't be happening for newly added routes.
    const whitelist = [
        'api', 'v4', 'users', 'teams', 'scheme', 'name', 'members', 'channels', 'posts', 'reactions', 'commands',
        'files', 'preferences', 'hooks', 'incoming', 'outgoing', 'oauth', 'apps', 'emoji', 'brand', 'image',
        'data_retention', 'jobs', 'plugins', 'roles', 'system', 'timezones', 'schemes', 'redirect_location', 'patch',
        'mfa', 'password', 'reset', 'send', 'active', 'verify', 'terms_of_service', 'login', 'logout', 'ids',
        'usernames', 'me', 'username', 'email', 'default', 'sessions', 'revoke', 'all', 'audits', 'device', 'status',
        'search', 'switch', 'authorized', 'authorize', 'deauthorize', 'tokens', 'disable', 'enable', 'exists', 'unread',
        'invite', 'batch', 'stats', 'import', 'schemeRoles', 'direct', 'group', 'convert', 'view', 'search_autocomplete',
        'thread', 'info', 'flagged', 'pinned', 'pin', 'unpin', 'opengraph', 'actions', 'thumbnail', 'preview', 'link',
        'delete', 'logs', 'ping', 'config', 'client', 'license', 'websocket', 'webrtc', 'token', 'regen_token',
        'autocomplete', 'execute', 'regen_secret', 'policy', 'type', 'cancel', 'reload', 'environment', 's3_test', 'file',
        'caches', 'invalidate', 'database', 'recycle', 'compliance', 'reports', 'cluster', 'ldap', 'test', 'sync', 'saml',
        'certificate', 'public', 'private', 'idp', 'elasticsearch', 'purge_indexes', 'analytics', 'old', 'webapp', 'fake',
    ];

    url = url.split('/').map((part) => {
        if (part !== '' && whitelist.indexOf(part) === -1) {
            return '<filtered>';
        }

        return part;
    }).join('/');

    if (index !== -1) {
        // Add this on afterwards since it wouldn't pass the whitelist
        url += '?<filtered>';
    }

    return url;
}
