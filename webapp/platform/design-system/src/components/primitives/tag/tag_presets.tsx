// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Tag from './tag';
import type {TagSize, TagVariant} from './tag';

/**
 * Internationalized Beta Tag
 * Replacement for beta_tag.tsx with i18n support
 */
interface BetaTagProps {
    className?: string;
    size?: TagSize;
    variant?: TagVariant;
}

export const BetaTag: React.FC<BetaTagProps> = ({
    className = '',
    size = 'xs',
    variant = 'info',
}) => {
    return (
        <Tag
            preset='beta'
            size={size}
            variant={variant}
            className={className}
        />
    );
};

/**
 * Internationalized Bot Tag
 * Replacement for bot_tag.tsx with i18n support
 */
interface BotTagProps {
    className?: string;
    size?: TagSize;
}

export const BotTag: React.FC<BotTagProps> = ({
    className = '',
    size = 'xs',
}) => {
    return (
        <Tag
            preset='bot'
            size={size}
            className={className}
        />
    );
};

/**
 * Pure Guest Tag Component
 *
 * This is a pure presentation component without Redux dependencies.
 * For automatic config-based hiding, use the container component from:
 * `webapp/channels/src/components/guest_tag`
 *
 * This component is part of the design system and should remain pure and reusable.
 *
 * @example
 * ```tsx
 * // Direct usage (you control visibility)
 * <GuestTag size="sm" hide={shouldHide} />
 *
 * // Or use the Redux-connected container (automatic hiding based on config)
 * import GuestTag from 'components/guest_tag';
 * <GuestTag size="sm" />
 * ```
 */
interface GuestTagProps {
    className?: string;
    size?: TagSize;

    /** Whether to hide the tag. Defaults to false. */
    hide?: boolean;
}

export const GuestTag: React.FC<GuestTagProps> = ({
    className = '',
    size = 'xs',
    hide = false,
}) => {
    return (
        <Tag
            preset='guest'
            size={size}
            className={className}
            hide={hide}
        />
    );
};

/**
 * NOTE: For custom internationalized tags, use the Tag component directly with useIntl():
 *
 * @example
 * const MyCustomTag = () => {
 *     const {formatMessage} = useIntl();
 *     return (
 *         <Tag
 *             text={formatMessage({
 *                 id: 'my.custom.tag',
 *                 defaultMessage: 'Custom Tag'
 *             })}
 *             variant="info"
 *         />
 *     );
 * };
 *
 * This approach ensures babel-plugin-formatjs can statically analyze messages for extraction.
 */

