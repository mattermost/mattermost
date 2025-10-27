// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {ContentFlaggingSettings} from '@mattermost/types/config';
import type {NameMappedPropertyFields, PropertyValue} from '@mattermost/types/properties';
import type {Post} from '@mattermost/types/posts';

/**
 * ContentFlaggingClient wraps Mattermost content flagging API endpoints.
 * Setup logic should use these helpers for API calls.
 */
export class ContentFlaggingClient {
    client: Client4;

    constructor(client: Client4) {
        this.client = client;
    }

    /**
     * Get content flagging config for a team (or global if no teamId)
     */
    getContentFlaggingConfig(teamId?: string): Promise<ContentFlaggingConfig> {
        return this.client.getContentFlaggingConfig(teamId);
    }

    /**
     * Flag a post with reason and optional comment
     */
    flagPost(postId: string, reason: string, comment?: string) {
        return this.client.flagPost(postId, reason, comment);
    }

    /**
     * Remove a flagged post (reviewer action)
     */
    removeFlaggedPost(postId: string, comment?: string) {
        return this.client.removeFlaggedPost(postId, comment);
    }

    /**
     * Keep a flagged post (reviewer action)
     */
    keepFlaggedPost(postId: string, comment?: string) {
        return this.client.keepFlaggedPost(postId, comment);
    }

    /**
     * Get property fields for content flagging
     */
    getPostContentFlaggingFields(): Promise<NameMappedPropertyFields> {
        return this.client.getPostContentFlaggingFields();
    }

    /**
     * Get property values for a flagged post
     */
    getPostContentFlaggingValues(postId: string): Promise<PropertyValue<unknown>[]> {
        return this.client.getPostContentFlaggingValues(postId);
    }

    /**
     * Get flagged post details
     */
    getFlaggedPost(postId: string): Promise<Post> {
        return this.client.getFlaggedPost(postId);
    }

    /**
     * Search for reviewers by term and team
     */
    searchContentFlaggingReviewers(term: string, teamId: string): Promise<UserProfile[]> {
        return this.client.searchContentFlaggingReviewers(term, teamId);
    }

    /**
     * Assign a reviewer to a flagged post
     */
    setContentFlaggingReviewer(postId: string, reviewerId: string): Promise<unknown> {
        return this.client.setContentFlaggingReviewer(postId, reviewerId);
    }

    /**
     * Save content flagging config (admin)
     */
    saveContentFlaggingConfig(config: ContentFlaggingSettings): Promise<unknown> {
        return this.client.saveContentFlaggingConfig(config);
    }

    /**
     * Get admin content flagging config
     */
    getAdminContentFlaggingConfig(): Promise<ContentFlaggingSettings> {
        return this.client.getAdminContentFlaggingConfig();
    }
}

// Helper functions for generating test data
export function generateFlagReason(): string {
    // Example: return a random reason or pick from a list
    const reasons = ['Spam', 'Abuse', 'Off-topic', 'Other'];
    return reasons[Math.floor(Math.random() * reasons.length)];
}

export function generateFlagComment(): string {
    // Example: return a random comment
    return `Flagged for testing at ${new Date().toISOString()}`;
}

export function generateContentFlaggingConfig(
    overrides: Partial<ContentFlaggingSettings> = {},
): ContentFlaggingSettings {
    // Example: basic config, override as needed
    return {
        EnableContentFlagging: true,
        NotificationSettings: {},
        AdditionalSettings: {
            Reasons: ['Spam', 'Abuse', 'Off-topic'],
            ReporterCommentRequired: false,
            ReviewerCommentRequired: false,
        },
        ReviewerSettings: {
            CommonReviewers: [],
            SystemAdminsAsReviewers: true,
            TeamAdminsAsReviewers: false,
        },
        ...overrides,
    } as ContentFlaggingSettings;
}
