// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {testConfig} from '@/test_config';

export type InbucketEmail = {
    id: string;
    to: string[];
    date: string;
    subject: string;
    body: {
        text: string;
        html: string;
    };
};

type InbucketEmailSummary = Pick<InbucketEmail, 'id' | 'date' | 'subject' | 'to'>;

type GetRecentEmailOptions = {
    receivedAfter?: Date;
    timeout?: number;
};

const DEFAULT_EMAIL_TIMEOUT = 30_000;
const EMAIL_POLL_INTERVAL = 500;

/**
 * Returns the newest email addressed to the exact recipient, waiting for Inbucket
 * when mail delivery is still in progress.
 */
export async function getRecentEmail(
    recipient: string,
    {receivedAfter, timeout = DEFAULT_EMAIL_TIMEOUT}: GetRecentEmailOptions = {},
): Promise<InbucketEmail> {
    const mailbox = recipient.split('@')[0];
    const mailboxURL = `${testConfig.smtpURL}/api/v1/mailbox/${encodeURIComponent(mailbox)}`;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const email = await getNewestMatchingEmail(mailboxURL, recipient, receivedAfter);
        if (email) {
            return email;
        }
        await new Promise((resolve) => setTimeout(resolve, EMAIL_POLL_INTERVAL));
    }

    throw new Error(`Timed out waiting for email to ${recipient}`);
}

export function extractEmailLink(email: InbucketEmail, pathname: string): string {
    const escapedPathname = pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const link = email.body.text.match(new RegExp(`https?://[^\\s<>"')]+${escapedPathname}[^\\s<>"')]+`))?.[0];

    if (!link) {
        throw new Error(`Email to ${email.to.join(', ')} does not contain a link for ${pathname}`);
    }

    return link.replaceAll('&amp;', '&');
}

/**
 * Extracts the bare email address from a mailbox `to` entry, which Inbucket
 * reports as `addr@host`, `<addr@host>`, or `Display Name <addr@host>`.
 */
function parseEmailAddress(entry: string): string {
    const angleBracketMatch = entry.match(/<([^<>]+)>\s*$/);
    return (angleBracketMatch ? angleBracketMatch[1] : entry).trim().toLowerCase();
}

async function getNewestMatchingEmail(
    mailboxURL: string,
    recipient: string,
    receivedAfter?: Date,
): Promise<InbucketEmail | undefined> {
    const response = await fetch(mailboxURL);
    if (!response.ok) {
        return undefined;
    }

    const summaries = (await response.json()) as InbucketEmailSummary[];
    const normalizedRecipient = recipient.toLowerCase();
    const receivedAfterTime = receivedAfter?.getTime();
    const matchingSummaries = summaries.filter((summary) => {
        const addressedToRecipient = summary.to.some((address) => parseEmailAddress(address) === normalizedRecipient);
        const arrivedInTime = receivedAfterTime === undefined || new Date(summary.date).getTime() >= receivedAfterTime;

        return addressedToRecipient && arrivedInTime;
    });

    for (const summary of matchingSummaries.reverse()) {
        const messageResponse = await fetch(`${mailboxURL}/${encodeURIComponent(summary.id)}`);
        if (!messageResponse.ok) {
            continue;
        }

        return (await messageResponse.json()) as InbucketEmail;
    }

    return undefined;
}
