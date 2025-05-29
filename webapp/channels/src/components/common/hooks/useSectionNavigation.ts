// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useRef, useEffect} from 'react';

interface UseSectionNavigationReturn {
    activeSectionKey: string | null;
    setActiveSectionKey: (key: string | null) => void;
    sectionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export function useSectionNavigation(
    sectionKeys: string[],
    observerOptions: IntersectionObserverInit = {},
): UseSectionNavigationReturn {
    const [activeSectionKey, setActiveSectionKey] = useState<string | null>(
        sectionKeys.length > 0 ? sectionKeys[0] : null,
    );
    const [intersectingSectionKeys, setIntersectingSectionKeys] = useState<Set<string>>(new Set());
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // IntersectionObserver setup
    useEffect(() => {
        if (sectionKeys.length === 0) {
            return undefined;
        }

        const observerCallback = (entries: IntersectionObserverEntry[]) => {
            setIntersectingSectionKeys((prevKeys) => {
                const newKeys = new Set(prevKeys);
                entries.forEach((entry) => {
                    const key = (entry.target as HTMLElement).dataset.sectionKey;
                    if (key) {
                        if (entry.isIntersecting) {
                            newKeys.add(key);
                        } else {
                            newKeys.delete(key);
                        }
                    }
                });
                return newKeys;
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        sectionKeys.forEach((key) => {
            const el = sectionRefs.current[key];
            if (el) {
                observer.observe(el);
            }
        });

        return () => {
            observer.disconnect();
        };
    }, [sectionKeys, observerOptions]);

    // Determine active section based on intersections
    useEffect(() => {
        let newActiveKey: string | null = null;

        if (intersectingSectionKeys.size > 0) {
            for (const section of sectionKeys) {
                if (intersectingSectionKeys.has(section)) {
                    newActiveKey = section; // First section in DOM order that's intersecting
                    break;
                }
            }
        }

        if (newActiveKey && newActiveKey !== activeSectionKey) {
            setActiveSectionKey(newActiveKey);
        } else if (!activeSectionKey && newActiveKey && sectionKeys.length > 0) {
            setActiveSectionKey(newActiveKey);
        }
    }, [intersectingSectionKeys, sectionKeys, activeSectionKey]);

    return {
        activeSectionKey,
        setActiveSectionKey,
        sectionRefs,
    };
}
