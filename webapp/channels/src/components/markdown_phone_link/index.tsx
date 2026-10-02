// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {PhoneIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import PluginLinkTooltip from 'components/plugin_link_tooltip';

import './markdown_phone_link.scss';

const TEL_PREFIX = 'tel:';

type Props = {
    href: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
    target?: string;
    rel?: string;
    hasPluginTooltips?: boolean;
};

export default function MarkdownPhoneLink(props: Props) {
    const anchorProps = {
        href: props.href,
        className: classNames('markdown-phone-link', props.className),
        title: props.title,
        target: props.target,
        rel: props.rel,
    };

    const content = (
        <>
            <PhoneIcon
                size={12}
                aria-hidden='true'
            />
            <span>{stripTelPrefixFromAutolink(props.href, props.children)}</span>
        </>
    );

    // PluginLinkTooltip renders its own anchor, so it replaces ours instead of wrapping it.
    if (props.hasPluginTooltips) {
        return (
            <PluginLinkTooltip nodeAttributes={anchorProps}>
                {content}
            </PluginLinkTooltip>
        );
    }

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='markdown_phone_link.tooltip'
                    defaultMessage='Click to call {phoneNumber}'
                    description='Tooltip shown when hovering a phone number link in a message.'
                    values={{
                        phoneNumber: props.href.slice(TEL_PREFIX.length),
                    }}
                />
            }
        >
            <a {...anchorProps}>{content}</a>
        </WithTooltip>
    );
}

// Auto-linked numbers show the raw href as their text, so drop the scheme to show just the number.
function stripTelPrefixFromAutolink(href: string, children: React.ReactNode) {
    const nodes = React.Children.toArray(children);
    if (nodes.length === 1 && nodes[0] === href) {
        return href.slice(TEL_PREFIX.length);
    }

    return children;
}
