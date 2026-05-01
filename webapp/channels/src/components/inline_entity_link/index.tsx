// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MouseEvent} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LinkVariantIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import {handleInlineEntityClick} from './actions';
import {InlineEntityTypes} from './constants';
import {parseInlineEntityUrl} from './utils';

import './inline_entity_link.scss';

type Props = {
    url: string;
    text: React.ReactNode;
    className?: string;
};

export default function InlineEntityLink({url, text, className}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();

    const {type, postId, teamName, channelName} = parseInlineEntityUrl(url);

    if (!type) {
        return (
            <a
                href={url}
                className={className}
            >
                {text}
            </a>
        );
    }

    const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch(handleInlineEntityClick(type, postId, teamName, channelName));
    };

    let tooltipText = '';
    switch (type) {
    case InlineEntityTypes.POST:
        tooltipText = intl.formatMessage({id: 'inline_entity_link.tooltip.post', defaultMessage: 'Go to post'});
        break;
    case InlineEntityTypes.CHANNEL:
        tooltipText = intl.formatMessage({id: 'inline_entity_link.tooltip.channel', defaultMessage: 'Go to channel'});
        break;
    case InlineEntityTypes.TEAM:
        tooltipText = intl.formatMessage({id: 'inline_entity_link.tooltip.team', defaultMessage: 'Go to team'});
        break;
    }

    return (
        <WithTooltip
            title={tooltipText}
            forcedPlacement='top'
        >
            <a
                href={url}
                className={classNames('inline-entity-link', className)}
                onClick={handleClick}
                aria-label={tooltipText}
            >
                <LinkVariantIcon
                    size={14}
                />
            </a>
        </WithTooltip>
    );
}
