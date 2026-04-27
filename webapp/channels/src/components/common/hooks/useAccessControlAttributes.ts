// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {AccessControlAttribute} from '@mattermost/types/access_control';

import {getChannelAccessControlAttributes} from 'mattermost-redux/actions/channels';

// Define supported entity types
export enum EntityType {
    Channel = 'channel',

    // more entity types will be added here in the future
}

// ProcessedAttributes is the shape that components consume: a structured
// dictionary of attribute -> values (used for the policy banners) plus a flat
// tag array (kept for backwards compatibility with consumers that only need
// the values without their owning attribute).
type ProcessedAttributes = {
    attributeTags: string[];
    structuredAttributes: AccessControlAttribute[];
};

// Module-level cache for access control attributes. The cache stores already
// processed data with a timestamp to implement a short TTL.
const attributesCache: Record<string, {
    processedData: ProcessedAttributes;
    timestamp: number;
}> = {};

// Cache TTL in milliseconds (5 minutes).
const CACHE_TTL = 5 * 60 * 1000;

// Array of supported entity types for validation
const SUPPORTED_ENTITY_TYPES = Object.values(EntityType);

const EMPTY_PROCESSED: ProcessedAttributes = {
    attributeTags: [],
    structuredAttributes: [],
};

// processAttributeData converts the server response (a dictionary keyed by
// attribute name with arrays of literal values) into the structured form
// consumed by the UI. The dictionary preserves both the attribute name and
// the values associated with it so each tag can be displayed alongside its
// originating attribute.
function processAttributeData(data: Record<string, string[]> | undefined | null): ProcessedAttributes {
    if (!data) {
        return EMPTY_PROCESSED;
    }

    const attributeTags: string[] = [];
    const structuredAttributes: AccessControlAttribute[] = [];

    // Format: { "attributeName": ["value1", "value2"], "anotherAttribute": ["value3"] }
    for (const [name, values] of Object.entries(data)) {
        if (!Array.isArray(values)) {
            continue;
        }

        structuredAttributes.push({name, values: [...values]});

        for (const value of values) {
            if (value !== undefined && value !== null) {
                attributeTags.push(value);
            }
        }
    }

    return {attributeTags, structuredAttributes};
}

// Listeners that mounted hook instances register to be notified when the
// module-level cache is invalidated for an entity they care about. Used to
// trigger a re-fetch in response to server-side policy changes that arrive
// out-of-band of the hook's normal dependency-driven refresh.
type InvalidationListener = (entityType: EntityType | undefined, entityId: string | undefined) => void;
const invalidationListeners = new Set<InvalidationListener>();

/**
 * Invalidates cached access control attributes for an entity. When both
 * entityType and entityId are provided, only that entity's cache entry is
 * dropped; when omitted, the entire module-level cache is cleared. After
 * dropping the cache entry/entries, all mounted instances of
 * useAccessControlAttributes that match the invalidated entity (or all of
 * them, when called without arguments) will immediately re-fetch so that
 * consumers (e.g. the channel invite modal banner) pick up the new attribute
 * set without waiting for the cache TTL to expire.
 */
export function invalidateAccessControlAttributesCache(
    entityType?: EntityType,
    entityId?: string,
): void {
    if (!entityType || !entityId) {
        for (const key of Object.keys(attributesCache)) {
            delete attributesCache[key];
        }
    } else {
        delete attributesCache[`${entityType}:${entityId}`];
    }

    invalidationListeners.forEach((listener) => listener(entityType, entityId));
}

/**
 * A hook for fetching access control attributes for an entity
 *
 * @param entityType - The type of entity (e.g., 'channel')
 * @param entityId - The ID of the entity
 * @param hasAccessControl - Whether the entity has access control enabled
 * @returns An object containing the attribute tags, loading state, and fetch function
 */
export const useAccessControlAttributes = (
    entityType: EntityType,
    entityId: string | undefined,
    hasAccessControl: boolean | undefined,
) => {
    const [attributeTags, setAttributeTags] = useState<string[]>([]);
    const [structuredAttributes, setStructuredAttributes] = useState<AccessControlAttribute[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const dispatch = useDispatch();

    const applyProcessed = useCallback((processed: ProcessedAttributes) => {
        setAttributeTags(processed.attributeTags);
        setStructuredAttributes(processed.structuredAttributes);
    }, []);

    const fetchAttributes = useCallback(async (forceRefresh = false) => {
        if (!entityId || !hasAccessControl) {
            setAttributeTags([]);
            setStructuredAttributes([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (!SUPPORTED_ENTITY_TYPES.includes(entityType)) {
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            const cacheKey = `${entityType}:${entityId}`;
            const cachedEntry = attributesCache[cacheKey];
            const now = Date.now();

            // Serve from cache when fresh and the caller didn't force a refresh.
            if (!forceRefresh && cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
                applyProcessed(cachedEntry.processedData);
                setLoading(false);
                return;
            }

            let result;
            switch (entityType) {
            case EntityType.Channel:
                result = await dispatch(getChannelAccessControlAttributes(entityId));
                break;
            default:
                // defensive programming: if we add new entity types, we should handle them here
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            if (result.error) {
                throw result.error;
            }

            const processed = processAttributeData(result.data);
            attributesCache[cacheKey] = {processedData: processed, timestamp: now};
            applyProcessed(processed);
        } catch (err) {
            setError(err as Error);
            applyProcessed(EMPTY_PROCESSED);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, hasAccessControl, dispatch, applyProcessed]);

    useEffect(() => {
        fetchAttributes();
    }, [fetchAttributes]);

    // Re-fetch when the cache is invalidated for this entity (e.g. when a
    // policy change is broadcast over the websocket). Without this, the
    // hook's input dependencies may not change even though the underlying
    // attribute set on the server did.
    useEffect(() => {
        const listener: InvalidationListener = (invalidatedType, invalidatedId) => {
            const matchesEntity = !invalidatedType || !invalidatedId ||
                (invalidatedType === entityType && invalidatedId === entityId);
            if (matchesEntity) {
                fetchAttributes(true);
            }
        };
        invalidationListeners.add(listener);
        return () => {
            invalidationListeners.delete(listener);
        };
    }, [entityType, entityId, fetchAttributes]);

    return {
        attributeTags,
        structuredAttributes,
        loading,
        error,
        fetchAttributes,
    };
};

export default useAccessControlAttributes;
