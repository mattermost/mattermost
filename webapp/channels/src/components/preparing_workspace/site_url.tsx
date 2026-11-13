// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import {Client4} from 'mattermost-redux/client';

import LaptopEarthSVG from 'components/common/svg_images_components/laptop_earth_svg';
import ExternalLink from 'components/external_link';
import QuickInput from 'components/quick_input';

import Constants, {DocLinks} from 'utils/constants';

import Description from './description';
import PageBody from './page_body';
import PageLine from './page_line';
import SiteUrlStatus, {SiteUrlStatuses} from './site_url_status';
import type {SiteUrlStatusType} from './site_url_status';
import {Animations, mapAnimationReasonToClass} from './steps';
import type {PreparingWorkspacePageProps} from './steps';
import Title from './title';

import './site_url.scss';

const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

// The server doesn't time out when it fetches the URL, so give up on the test after a while.
const TEST_TIMEOUT = 10000;

// Adds the browser's protocol when the URL has none, and trims one trailing slash like the server does.
export function normalizeSiteUrl(input: string, protocol = window.location.protocol): string {
    let url = input.trim();
    if (!(/^[a-z][a-z\d+.-]*:\/\//i).test(url)) {
        url = `${protocol}//${url}`;
    }
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Matches the server check: an http(s) origin only, with a hostname and an optional port from 1 to 65535,
// and without a path, query, fragment or user info.
export function isValidSiteUrl(url: string): boolean {
    if (!(/^https?:\/\/[^/?#@%\\\s]+$/).test(url) || url.endsWith(':')) {
        return false;
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    // URL drops a default port, such as 443 for https, and throws for a port above 65535.
    return parsed.hostname !== '' && parsed.port !== '0';
}

export function getHostHint(url: string): 'loopback' | 'ip' | null {
    let hostname;
    try {
        hostname = new URL(url).hostname;
    } catch {
        return null;
    }
    if (hostname === 'localhost' || hostname === '[::1]' || (IPV4_REGEX.test(hostname) && hostname.startsWith('127.'))) {
        return 'loopback';
    }
    if (IPV4_REGEX.test(hostname) || hostname.startsWith('[')) {
        return 'ip';
    }
    return null;
}

type Props = PreparingWorkspacePageProps & {
    url: string;
    setUrl: (url: string) => void;
    className?: string;
};

const SiteUrl = (props: Props) => {
    const {formatMessage} = useIntl();
    const nodeRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<SiteUrlStatusType>(SiteUrlStatuses.Idle);

    // The test can take a while. Ignore its result if the admin edits the URL or leaves the step meanwhile.
    const testRun = useRef(0);
    useEffect(() => {
        testRun.current++;
        if (props.show) {
            setStatus(SiteUrlStatuses.Idle);
        }
    }, [props.show]);

    const normalizedUrl = normalizeSiteUrl(props.url);
    const hint = getHostHint(normalizedUrl);

    const onNext = async (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && (e as React.KeyboardEvent).key) {
            if ((e as React.KeyboardEvent).key !== Constants.KeyCodes.ENTER[0]) {
                return;
            }
        }
        if (status === SiteUrlStatuses.Testing || !props.url.trim()) {
            return;
        }
        if (!isValidSiteUrl(normalizedUrl)) {
            setStatus(SiteUrlStatuses.Invalid);
            return;
        }

        props.setUrl(normalizedUrl);
        setStatus(SiteUrlStatuses.Testing);
        const run = ++testRun.current;
        let ok = true;
        let timeout;
        try {
            await Promise.race([
                Client4.testSiteURL(normalizedUrl),
                new Promise((resolve, reject) => {
                    timeout = setTimeout(reject, TEST_TIMEOUT);
                }),
            ]);
        } catch {
            ok = false;
        } finally {
            clearTimeout(timeout);
        }
        if (run !== testRun.current) {
            return;
        }
        if (ok) {
            setStatus(SiteUrlStatuses.Success);
            props.next?.();
        } else {
            setStatus(SiteUrlStatuses.Failed);
        }
    };

    let className = 'SiteUrl-body';
    if (props.className) {
        className += ' ' + props.className;
    }

    return (
        <CSSTransition
            in={props.show}
            nodeRef={nodeRef}
            timeout={Animations.PAGE_SLIDE}
            classNames={mapAnimationReasonToClass('SiteUrl', props.transitionDirection)}
            mountOnEnter={true}
            unmountOnExit={true}
        >
            <div
                ref={nodeRef}
                className={className}
            >
                <div className='SiteUrl-right-col'>
                    <div className='SiteUrl-form-wrapper'>
                        <div className='SiteUrl__progress-path'>
                            <div className='SiteUrl__line-above'>
                                <PageLine
                                    style={{height: 'calc(50vh)'}}
                                    noLeft={true}
                                />
                            </div>
                            <LaptopEarthSVG/>
                            <PageLine
                                style={{
                                    marginTop: '5px',
                                    height: 'calc(50vh)',
                                }}
                                noLeft={true}
                            />
                        </div>
                        <div className='SiteUrl__content'>
                            {props.previous}
                            <Title>
                                <FormattedMessage
                                    id='onboarding_wizard.site_url.title'
                                    defaultMessage='Confirm your server’s URL'
                                />
                            </Title>
                            <Description>
                                <FormattedMessage
                                    id='onboarding_wizard.site_url.description'
                                    defaultMessage='This is the URL that users will use to access Mattermost. <a>See documentation</a> for more.'
                                    values={{
                                        a: (chunks: React.ReactNode) => (
                                            <ExternalLink
                                                location='preparing_workspace_site_url'
                                                href={DocLinks.SITE_URL}
                                            >
                                                {chunks}
                                            </ExternalLink>
                                        ),
                                    }}
                                />
                            </Description>
                            <PageBody>
                                <QuickInput
                                    placeholder={formatMessage({
                                        id: 'onboarding_wizard.site_url.placeholder',
                                        defaultMessage: 'https://chat.example.com',
                                    })}
                                    className='SiteUrl__input'
                                    value={props.url}
                                    onChange={(e) => {
                                        testRun.current++;
                                        props.setUrl(e.target.value);
                                        setStatus(SiteUrlStatuses.Idle);
                                    }}
                                    onKeyUp={onNext}
                                    autoFocus={true}
                                />
                                <div className='SiteUrl__help'>
                                    <FormattedMessage
                                        id='onboarding_wizard.site_url.help'
                                        defaultMessage='Standard ports, such as 80 and 443, can be omitted, but non-standard ports are required'
                                    />
                                </div>
                                {hint === 'loopback' && (
                                    <div className='SiteUrl__hint'>
                                        <i className='icon icon-information-outline'/>
                                        <FormattedMessage
                                            id='onboarding_wizard.site_url.hint_loopback'
                                            defaultMessage='This address only works on this computer. Other people won’t be able to reach Mattermost at it.'
                                        />
                                    </div>
                                )}
                                {hint === 'ip' && (
                                    <div className='SiteUrl__hint'>
                                        <i className='icon icon-information-outline'/>
                                        <FormattedMessage
                                            id='onboarding_wizard.site_url.hint_ip'
                                            defaultMessage='An IP address works, but a domain name is easier to share and is needed for most HTTPS certificates.'
                                        />
                                    </div>
                                )}
                                <SiteUrlStatus status={status}/>
                            </PageBody>
                            <div>
                                <button
                                    className='primary-button'
                                    data-testid='continue'
                                    onClick={onNext}
                                    disabled={status === SiteUrlStatuses.Testing || !props.url.trim()}
                                >
                                    <FormattedMessage
                                        id='onboarding_wizard.next'
                                        defaultMessage='Continue'
                                    />
                                </button>
                                {status === SiteUrlStatuses.Failed && (
                                    <button
                                        className='tertiary-button'
                                        onClick={props.next}
                                    >
                                        <FormattedMessage
                                            id='onboarding_wizard.site_url.use_anyway'
                                            defaultMessage='Use anyway'
                                        />
                                    </button>
                                )}
                                <button
                                    className='tertiary-button'
                                    onClick={props.skip}
                                >
                                    <FormattedMessage
                                        id='onboarding_wizard.site_url.skip'
                                        defaultMessage='I’ll do this later'
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CSSTransition>
    );
};

export default SiteUrl;
