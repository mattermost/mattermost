// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Permissions, {CHANNEL_WRITE_PERMISSIONS} from 'mattermost-redux/constants/permissions';

describe('CHANNEL_WRITE_PERMISSIONS', () => {
    it('mirrors isChannelWritePermission in server/channels/app/channel_access.go', () => {
        expect(CHANNEL_WRITE_PERMISSIONS.size).toBe(38);
    });

    it('contains only known permissions', () => {
        const known = new Set(Object.values(Permissions).filter((value): value is string => typeof value === 'string'));

        for (const permission of CHANNEL_WRITE_PERMISSIONS) {
            expect(known).toContain(permission);
        }
    });

    it('excludes read access and policy administration', () => {
        expect(CHANNEL_WRITE_PERMISSIONS.has(Permissions.READ_CHANNEL)).toBe(false);
        expect(CHANNEL_WRITE_PERMISSIONS.has(Permissions.READ_CHANNEL_CONTENT)).toBe(false);
        expect(CHANNEL_WRITE_PERMISSIONS.has(Permissions.MANAGE_CHANNEL_ACCESS_RULES)).toBe(false);
    });
});
