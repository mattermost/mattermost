// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useRef} from 'react';

/**
 * Returns a ref that always holds the latest value.
 * Useful for accessing current values in callbacks without
 * adding them to dependency arrays.
 */
export function useLatest<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}
