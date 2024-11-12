// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @mattermost/use-external-link */

import React, {forwardRef} from 'react';

import {trackEvent} from 'actions/telemetry_actions';

import type {ExternalLinkQueryParams} from 'components/common/hooks/use_external_link';
import {useExternalLink} from 'components/common/hooks/use_external_link';

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    target?: string;
    rel?: string;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    queryParams?: ExternalLinkQueryParams;
    location: string;
    children: React.ReactNode;
}

const ExternalLink = forwardRef<HTMLAnchorElement, Props>((props, ref) => {
    const [href, queryParams] = useExternalLink(props.href, props.location, props.queryParams);

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
        trackEvent('link_out', 'click_external_link', queryParams);
        if (typeof props.onClick === 'function') {
            props.onClick(e);
        }
    };

    return (
        <a
            {...props}
            ref={ref}
            target={props.target || '_blank'}
            rel={props.rel || 'noopener noreferrer'}
            onClick={handleClick}
            href={href}
        >
            {props.children}
        </a>
    );
});

export default ExternalLink;
