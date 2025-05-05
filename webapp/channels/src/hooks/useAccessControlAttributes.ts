// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback} from 'react';

import {Client4} from 'mattermost-redux/client';

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

    const fetchAttributes = useCallback(async () => {
        if (!entityId || !hasAccessControl) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let url;
            switch (entityType) {
            case 'channel':
                url = `${Client4.getChannelsRoute()}/${entityId}/access_control/attributes`;
                break;
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            const response = await fetch(url, { // TODO: replace with Client4 correct implementation
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Authorization: `Bearer ${Client4.getToken()}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch access control attributes: ${response.status}`);
            }

            const data = await response.json();
            const tags: string[] = [];

            // Extract values from all properties in the response
            // Format: { "attributeName": ["value1", "value2"], "anotherAttribute": ["value3"] }
            Object.entries(data).forEach(([, values]) => {
                if (Array.isArray(values)) {
                    values.forEach((value) => {
                        if (value !== undefined && value !== null) {
                            tags.push(value);
                        }
                    });
                }
            });

            setAttributeTags(tags);
        } catch (err) {
            setError(err as Error);
            setAttributeTags([]);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, hasAccessControl]);

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
