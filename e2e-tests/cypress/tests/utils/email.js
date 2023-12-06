// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getEmailUrl() {
    const smtpUrl = Cypress.env('smtpUrl') || 'http://localhost:9001';

    return `${smtpUrl}/api/v1/mailbox`;
}

export function splitEmailBodyText(text) {
    return text.split('\n').map((d) => d.trim());
}

export function getEmailResetEmailTemplate(userEmail) {
    return [
        '----------------------',
        'You updated your email',
        '----------------------',
        '',
        `Your email address for Mattermost has been changed to ${userEmail}.`,
        'If you did not make this change, please contact the system administrator.',
        '',
        'To change your notification preferences, log in to your team site and go to Settings > Notifications.',
    ];
}

export function getJoinEmailTemplate(sender, userEmail, team, isGuest = false) {
    const baseUrl = Cypress.config('baseUrl');

    return [
        `${sender} invited you to join the ${team.display_name} team.`,
        `${isGuest ? 'You were invited as a guest to collaborate with the team' : 'Start collaborating with your team on Mattermost'}`,
        '',
        `<join-link-check> Join now ( ${baseUrl}/signup_user_complete/?d=${encodeURIComponent(JSON.stringify({display_name: team.display_name.replace(' ', '+'), email: userEmail, name: team.name}))}&t=<actual-token> )`,
        '',
        'What is Mattermost?',
        'Mattermost is a flexible, open source messaging platform that enables secure team collaboration.',
        'Learn more ( mattermost.com )',
        '',
        '© 2022 Mattermost, Inc. 530 Lytton Avenue, Second floor, Palo Alto, CA, 94301',
    ];
}

export function getMentionEmailTemplate(sender, message, postId, siteName, teamName, channelDisplayName) {
    const baseUrl = Cypress.config('baseUrl');

    return [
        `@${sender} mentioned you in a message`,
        `While you were away, @${sender} mentioned you in the ${channelDisplayName} channel.`,
        '',
        `Reply in Mattermost ( ${baseUrl}/landing#/${teamName}/pl/${postId} )`,
        '',
        `@${sender}`,
        '<skip-local-time-check>',
        channelDisplayName,
        '',
        message,
        '',
        'Want to change your notifications settings?',
        `Login to ${siteName} ( ${baseUrl} ) and go to Settings > Notifications`,
        '',
        '© 2022 Mattermost, Inc. 530 Lytton Avenue, Second floor, Palo Alto, CA, 94301',
    ];
}

export function getPasswordResetEmailTemplate() {
    const baseUrl = Cypress.config('baseUrl');

    return [
        'Reset Your Password',
        'Click the button below to reset your password. If you didn’t request this, you can safely ignore this email.',
        '',
        `<reset-password-link-check> Reset Password ( http://${baseUrl}/reset_password_complete?token=<actual-token> )`,
        '',
        'The password reset link expires in 24 hours.',
        '',
        '© 2022 Mattermost, Inc. 530 Lytton Avenue, Second floor, Palo Alto, CA, 94301',
    ];
}

export function getEmailVerifyEmailTemplate(userEmail) {
    const baseUrl = Cypress.config('baseUrl');

    return [
        'Verify your email address',
        `Thanks for joining ${baseUrl.split('/')[2]}. ( ${baseUrl} )`,
        'Click below to verify your email address.',
        '',
        `<email-verify-link-check> Verify Email ( ${baseUrl}/do_verify_email?token=<actual-token>&email=${encodeURIComponent(userEmail)} )`,
        '',
        'This email address was used to create an account with Mattermost.',
        'If it was not you, you can safely ignore this email.',
        '',
        '© 2022 Mattermost, Inc. 530 Lytton Avenue, Second floor, Palo Alto, CA, 94301',
    ];
}

export function getWelcomeEmailTemplate(userEmail, siteName, teamName) {
    const baseUrl = Cypress.config('baseUrl');

    return [
        'Welcome to the team',
        `Thanks for joining ${baseUrl.split('/')[2]}. ( ${baseUrl} )`,
        'Click below to verify your email address.',
        '',
        `<email-verify-link-check> Verify Email ( ${baseUrl}/do_verify_email?token=<actual-token>&email=${encodeURIComponent(userEmail)}&redirect_to=/${teamName} )`,
        '',
        `This email address was used to create an account with ${siteName}.`,
        'If it was not you, you can safely ignore this email.',
        '',
        'Download the desktop and mobile apps',
        'For the best experience, download the apps for PC, Mac, iOS and Android.',
        '',
        'Download ( https://mattermost.com/pl/download-apps )',
        '',
        '© 2022 Mattermost, Inc. 530 Lytton Avenue, Second floor, Palo Alto, CA, 94301',
    ];
}

export function verifyEmailBody(expectedBody, actualBody) {
    expect(expectedBody.length).to.equal(actualBody.length);

    for (let i = 0; i < expectedBody.length; i++) {
        if (expectedBody[i].includes('skip-local-time-check')) {
            continue;
        }

        if (expectedBody[i].includes('email-verify-link-check')) {
            expect(actualBody[i]).to.include('Verify Email');
            expect(actualBody[i]).to.include('do_verify_email?token=');
            continue;
        }

        if (expectedBody[i].includes('join-link-check')) {
            expect(actualBody[i]).to.include('Join now');
            expect(actualBody[i]).to.include('signup_user_complete/?d=');
            continue;
        }

        if (expectedBody[i].includes('reset-password-link-check')) {
            expect(actualBody[i]).to.include('Reset Password');
            expect(actualBody[i]).to.include('reset_password_complete?token=');
            continue;
        }

        expect(expectedBody[i], `Line ${i} expects "${expectedBody[i]}" but got ${actualBody[i]}`).to.equal(actualBody[i]);
    }
}
