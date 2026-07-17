// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client} from 'pg';

const defaultDatabaseUrl =
    'postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes';

type StoredSession = {
    id: string;
    userid: string;
    expiresat: string;
};

async function query<T>(sql: string, values: unknown[] = []) {
    const client = new Client({connectionString: process.env.MM_TEST_DB_URL ?? defaultDatabaseUrl});
    await client.connect();
    try {
        return (await client.query(sql, values)).rows as T[];
    } finally {
        await client.end();
    }
}

export async function getActiveSessions(userId: string) {
    return query<StoredSession>(
        'SELECT Id AS id, UserId AS userid, ExpiresAt AS expiresat FROM Sessions WHERE UserId = $1 AND ExpiresAt > $2',
        [userId, Date.now()],
    );
}

export async function getSession(sessionId: string) {
    const sessions = await query<StoredSession>(
        'SELECT Id AS id, UserId AS userid, ExpiresAt AS expiresat FROM Sessions WHERE Id = $1',
        [sessionId],
    );
    return sessions[0];
}

export async function updateSessionExpiration(sessionId: string, expiresAt: number) {
    await query('UPDATE Sessions SET ExpiresAt = $1 WHERE Id = $2', [expiresAt, sessionId]);
    return getSession(sessionId);
}
