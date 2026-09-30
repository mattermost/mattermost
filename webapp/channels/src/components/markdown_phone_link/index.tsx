// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {PhoneIcon} from '@mattermost/compass-icons/components';

import './markdown_phone_link.scss';

const TEL_PREFIX = 'tel:';

type Props = {
    href: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
    target?: string;
    rel?: string;
};

export default function MarkdownPhoneLink(props: Props) {
    return (
        <a
            href={props.href}
            className={classNames('markdown-phone-link', props.className)}
            title={props.title}
            target={props.target}
            rel={props.rel}
        >
            <PhoneIcon
                size={12}
                aria-hidden='true'
            />
            <span>{stripTelPrefixFromAutolink(props.href, props.children)}</span>
        </a>
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
