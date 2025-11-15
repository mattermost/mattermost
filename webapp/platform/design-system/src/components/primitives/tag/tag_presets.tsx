// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import Tag from './tag';
import type {TagProps} from './tag';

type BetaTagProps = Omit<TagProps, 'text'>;

/**
 * Beta tag for indicating beta features.
 */
export const BetaTag: React.FC<BetaTagProps> = ({
    className = '',
    size = 'xs',
    variant = 'info',
    ...rest
}) => {
    const {formatMessage} = useIntl();

    return (
        <Tag
            text={formatMessage({
                id: 'tag.default.beta',
                defaultMessage: 'BETA',
            })}
            uppercase={true}
            size={size}
            variant={variant}
            className={className}
            {...rest}
        />
    );
};

type BotTagProps = Omit<TagProps, 'text'>;

/**
 * Bot tag for indicating bot accounts.
 */
export const BotTag: React.FC<BotTagProps> = ({
    className = '',
    size = 'xs',
    ...rest
}) => {
    const {formatMessage} = useIntl();

    return (
        <Tag
            text={formatMessage({
                id: 'tag.default.bot',
                defaultMessage: 'BOT',
            })}
            uppercase={true}
            size={size}
            className={className}
            {...rest}
        />
    );
};

type GuestTagProps = Omit<TagProps, 'text'> & {
    hide?: boolean;
};

/**
 * Guest tag for indicating guest user accounts.
 */
export const GuestTag: React.FC<GuestTagProps> = ({
    className = '',
    size = 'xs',
    hide = false,
    ...rest
}) => {
    const {formatMessage} = useIntl();

    if (hide) {
        return null;
    }

    return (
        <Tag
            text={formatMessage({
                id: 'tag.default.guest',
                defaultMessage: 'GUEST',
            })}
            uppercase={false}
            size={size}
            className={className}
            {...rest}
        />
    );
};
