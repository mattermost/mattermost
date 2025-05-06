// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {getChannelAccessControlAttributes} from 'mattermost-redux/actions/channels';

// Module-level cache for access control attributes
// The cache stores data with a timestamp to implement a TTL (time-to-live)
const attributesCache: Record<string, {
    data: Record<string, string[]>;
    timestamp: number;
}> = {};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * A hook for fetching access control attributes for an entity
 *
 * @param entityType - The type of entity (e.g., 'channel')
 * @param entityId - The ID of the entity
 * @param hasAccessControl - Whether the entity has access control enabled
 * @returns An object containing the attribute tags, loading state, and fetch function
 */
export const useAccessControlAttributes = (
    entityType: 'channel',
    entityId: string | undefined,
    hasAccessControl: boolean | undefined,
) => {
    const [attributeTags, setAttributeTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const dispatch = useDispatch();

    // Helper function to process attribute data and extract tags
    const processAttributeData = useCallback((data: Record<string, string[]> | undefined) => {
        if (!data) {
            // eslint-disable-next-line no-console
            console.log('[DEBUG] useAccessControlAttributes: No data to process');
            setAttributeTags([]);
            return;
        }

        const tags: string[] = [];

        // Extract values from all properties in the response
        // Format: { "attributeName": ["value1", "value2"], "anotherAttribute": ["value3"] }
        Object.entries(data).forEach(([key, values]) => {
            // eslint-disable-next-line no-console
            console.log(`[DEBUG] useAccessControlAttributes: Processing attribute "${key}" with values:`, values);
            if (Array.isArray(values)) {
                values.forEach((value) => {
                    if (value !== undefined && value !== null) {
                        tags.push(value);
                    }
                });
            }
        });

        // eslint-disable-next-line no-console
        console.log('[DEBUG] useAccessControlAttributes: Final tags array:', tags);
        setAttributeTags(tags);
    }, []);

    const fetchAttributes = useCallback(async () => {
        // Add debugging for the hook parameters
        // eslint-disable-next-line no-console
        console.log('[DEBUG] useAccessControlAttributes params:', {
            entityType,
            entityId,
            hasAccessControl,
        });

        if (!entityId || !hasAccessControl) {
            // eslint-disable-next-line no-console
            console.log('[DEBUG] useAccessControlAttributes: Skipping fetch - entityId or hasAccessControl is falsy');
            return;
        }

        // Check cache first
        const cacheKey = `${entityType}:${entityId}`;
        const cachedEntry = attributesCache[cacheKey];
        const now = Date.now();

        // Use cache if it exists and is not too old
        if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
            // eslint-disable-next-line no-console
            console.log('[DEBUG] useAccessControlAttributes: Using cached data for', cacheKey);
            processAttributeData(cachedEntry.data);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let data;
            let result;

            switch (entityType) {
            case 'channel':
                // eslint-disable-next-line no-console
                console.log('[DEBUG] useAccessControlAttributes: Fetching channel attributes for channel ID:', entityId);

                // Use the Redux action
                // eslint-disable-next-line no-console
                console.log('[DEBUG] useAccessControlAttributes: Dispatching getChannelAccessControlAttributes action');
                result = await dispatch(getChannelAccessControlAttributes(entityId));
                // eslint-disable-next-line no-console
                console.log('[DEBUG] useAccessControlAttributes: Action result:', result);

                data = result.data;

                // Store in cache
                if (data) {
                    // eslint-disable-next-line no-console
                    console.log('[DEBUG] useAccessControlAttributes: Storing data in cache for', cacheKey);
                    attributesCache[cacheKey] = {
                        data,
                        timestamp: now,
                    };
                }

                // eslint-disable-next-line no-console
                console.log('[DEBUG] useAccessControlAttributes: Received data:', data);
                break;
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            processAttributeData(data);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[DEBUG] useAccessControlAttributes: Error fetching attributes:', err);
            setError(err as Error);
            setAttributeTags([]);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, hasAccessControl, processAttributeData]);

    // Fetch attributes when the component mounts or when dependencies change
    useEffect(() => {
        fetchAttributes();
    }, [fetchAttributes]);

    return {
        attributeTags,
        loading,
        error,
        fetchAttributes,
    };
};

export default useAccessControlAttributes;
