// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {isPreferenceOverridden} from 'selectors/preference_overrides';

import type {GlobalState} from 'types/store';

type Props = {
    /**
     * The preference category (e.g., "display_settings")
     */
    category: string;

    /**
     * The preference name (e.g., "use_military_time")
     */
    name: string;

    /**
     * Children to render if the preference is NOT overridden
     */
    children: React.ReactNode;
};

/**
 * A guard component that conditionally renders its children based on whether
 * the specified preference is admin-overridden.
 *
 * When a preference is overridden by an admin, users should not see the option
 * in their settings UI - the value is enforced server-side.
 *
 * Usage:
 * ```tsx
 * <PreferenceOverrideGuard category="display_settings" name="use_military_time">
 *     <ClockSection />
 * </PreferenceOverrideGuard>
 * ```
 */
const PreferenceOverrideGuard: React.FC<Props> = ({category, name, children}) => {
    const isOverridden = useSelector((state: GlobalState) => isPreferenceOverridden(state, category, name));

    if (isOverridden) {
        return null;
    }

    return <>{children}</>;
};

export default PreferenceOverrideGuard;
