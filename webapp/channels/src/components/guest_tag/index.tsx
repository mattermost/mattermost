// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {GuestTag as PureGuestTag} from '@mattermost/design-system';
import type {TagSize} from '@mattermost/design-system';

import {shouldHideGuestTags} from 'selectors/guest_tags';

/**
 * GuestTag Container Component
 *
 * This is a Redux-connected wrapper around the pure GuestTag component from the design system.
 * It automatically reads the HideGuestTags config from Redux state and passes it to the
 * presentation component.
 *
 * This follows the Container/Presentation pattern used throughout Mattermost where:
 * - Container (this file): Handles Redux state and business logic
 * - Presentation (@mattermost/design-system): Pure UI component
 *
 * The selector is memoized to prevent unnecessary re-renders when unrelated Redux state changes.
 *
 * @example
 * ```tsx
 * import GuestTag from 'components/guest_tag';
 *
 * <GuestTag size="sm" className="custom-class" />
 * ```
 */

interface GuestTagProps {
    className?: string;
    size?: TagSize;
}

const GuestTag: React.FC<GuestTagProps> = (props) => {
    // Use memoized selector to read HideGuestTags config from Redux state
    // This selector includes null safety and only re-runs when the config actually changes
    const hide = useSelector(shouldHideGuestTags);

    // Pass hide prop to pure presentation component
    return (
        <PureGuestTag
            {...props}
            hide={hide}
        />
    );
};

export default GuestTag;
