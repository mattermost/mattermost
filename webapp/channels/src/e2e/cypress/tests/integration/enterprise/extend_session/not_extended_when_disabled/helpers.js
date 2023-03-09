// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAdminAccount} from '../../../../support/env';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

const admin = getAdminAccount();
const oneDay = 24 * 60 * 60 * 1000;
const thirtySeconds = 30 * 1000;

export function verifyExtendedSession(testUser, sessionLengthInDays, channelUrl) {
    // # Login as test user and visit default channel
    cy.visit(channelUrl);

    // # Get active user sessions as baseline reference
    cy.dbGetActiveUserSessions({username: testUser.username}).then(({sessions: initialSessions}) => {
        expect(initialSessions.length).to.equal(1);
        const initialSession = initialSessions[0];

        // # Post a message to a channel
        const now = Date.now();
        cy.postMessage(now);

        // # Update user session which is to expire 20 sec from now
        const soonToExpire = getExpirationFromNow(thirtySeconds);
        cy.dbUpdateUserSession({
            userId: initialSession.userid,
            sessionId: initialSession.id,
            fieldsToUpdate: {expiresat: soonToExpire},
        }).then(({session: updatedSession}) => {
            // * Verify that the session is updated
            expect(parseInt(updatedSession.expiresat, 10)).to.equal(soonToExpire);

            // # Invalidate cache and reload to take effect the soon to expire session
            cy.externalRequest({user: admin, method: 'POST', path: 'caches/invalidate'});
            cy.reload();

            // # Visit default channel
            cy.visit(channelUrl);

            // # Get active session of test user
            cy.dbGetActiveUserSessions({username: testUser.username}).then(({sessions: extendedSessions}) => {
                expect(extendedSessions.length).to.equal(1);
                const extendedSession = extendedSessions[0];

                // * Verify that the session has been extended depending on session length (in days) setting
                expect(extendedSession.id).to.equal(updatedSession.id);
                expect(parseInt(extendedSession.expiresat, 10)).to.be.greaterThan(parseInt(updatedSession.expiresat, 10));
                expect(parseInt(extendedSession.expiresat, 10)).to.be.greaterThan(parseInt(initialSession.expiresat, 10));

                expect(parseInt(extendedSession.expiresat, 10)).to.be.closeTo(now + (sessionLengthInDays * oneDay * 0.042), thirtySeconds);
            });

            // # Post multiple times to check that the session continues and doesn't redirect to login page
            Cypress._.times(20, (i) => {
                cy.postMessage(i);
            });
        });
    });
}

export function verifyNotExtendedSession(testUser, channelUrl) {
    // # Login as test user and visit default channel
    cy.visit(channelUrl);

    // # Get active user sessions as baseline reference
    cy.dbGetActiveUserSessions({username: testUser.username}).then(({sessions: initialSessions}) => {
        expect(initialSessions.length).to.equal(1);
        const initialSession = initialSessions[0];
        expect(parseInt(initialSession.expiresat, 10)).to.be.greaterThan(0);

        // # Post a message to a channel
        const now = Date.now();
        cy.postMessage(`now: ${now}`);

        // # Update user session which is to expire 20 sec from now
        const soonToExpire = getExpirationFromNow(thirtySeconds);
        cy.dbUpdateUserSession({
            userId: initialSession.userid,
            sessionId: initialSession.id,
            fieldsToUpdate: {expiresat: soonToExpire},
        }).then(({session: updatedSession}) => {
            // * Verify that the session is updated
            expect(parseInt(updatedSession.expiresat, 10)).to.equal(soonToExpire);

            // # Invalidate cache and reload to take effect the soon to expire session
            cy.externalRequest({user: admin, method: 'POST', path: 'caches/invalidate'});
            cy.reload();

            // # Visit default channel
            cy.visit(channelUrl);

            // # Get active session of test user
            cy.dbGetActiveUserSessions({username: testUser.username}).then(({sessions: soonToExpireSessions}) => {
                // * Verify that the session was not extended
                expect(soonToExpireSessions.length).to.equal(1);
                expect(soonToExpireSessions[0].id).to.equal(updatedSession.id);
                expect(parseInt(soonToExpireSessions[0].expiresat, 10)).to.equal(parseInt(updatedSession.expiresat, 10));

                // * Verify that it redirects to login page due to expired session
                cy.waitUntil(() => {
                    return cy.url().then((url) => {
                        return url.includes('/login');
                    });
                }, {
                    timeout: TIMEOUTS.TWO_MIN,
                    interval: TIMEOUTS.TWO_SEC,
                });

                // * Verify that user has no active session
                cy.dbGetActiveUserSessions({username: testUser.username}).then(({sessions: activeSessions}) => {
                    expect(activeSessions.length).to.equal(0);
                });

                // * Verify that the session has not been extended
                cy.dbGetUserSession({sessionId: initialSession.id}).then(({session: unExtendedSession}) => {
                    expect(parseInt(unExtendedSession.expiresat, 10)).to.equal(soonToExpire);
                    expect(parseInt(unExtendedSession.expiresat, 10)).to.be.lessThan(Date.now());
                });
            });
        });
    });
}

function getExpirationFromNow(duration = 0) {
    return Date.now() + duration;
}
