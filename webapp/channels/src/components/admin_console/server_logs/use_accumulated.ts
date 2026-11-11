// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

// Every value seen so far, sorted, kept after later updates leave it out.
// The array keeps its identity until a new value arrives
export default function useAccumulated(values: readonly string[]): string[] {
    const [seen, setSeen] = useState<string[]>([]);
    useEffect(() => {
        setSeen((prev) => {
            const next = new Set([...prev, ...values]);
            return next.size === prev.length ? prev : Array.from(next).sort();
        });
    }, [values]);
    return seen;
}
