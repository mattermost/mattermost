// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

export type PolicySection = {
    id: string;
    label: MessageDescriptor;
};

type Props = {
    sections: PolicySection[];
    scrollEl: HTMLElement | null;
    errorSectionId?: string;
};

const CLICK_HOLD_MS = 800;

const messages = defineMessages({
    header: {
        id: 'admin.permission_policies.edit.sections.header',
        defaultMessage: 'Sections',
    },
    aria: {
        id: 'admin.permission_policies.edit.sections.aria',
        defaultMessage: 'Policy sections',
    },
    error: {
        id: 'admin.permission_policies.edit.sections.error',
        defaultMessage: ', has an error',
    },
});

export function scrollSectionIntoView(scrollEl: HTMLElement, section: HTMLElement) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gutter = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    const delta = section.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top;
    scrollEl.scrollTo({
        top: (delta + scrollEl.scrollTop) - gutter,
        behavior: reduce ? 'auto' : 'smooth',
    });
}

export default function PolicySectionsNav({sections, scrollEl, errorSectionId}: Props) {
    const {formatMessage} = useIntl();
    const [active, setActive] = useState(sections[0]?.id);
    const clickedAt = useRef(0);

    useEffect(() => {
        if (!scrollEl) {
            return undefined;
        }

        const update = () => {
            if (Date.now() - clickedAt.current < CLICK_HOLD_MS) {
                return;
            }
            const view = scrollEl.getBoundingClientRect();
            let current = sections[0]?.id;
            let most = 0;
            for (const section of sections) {
                const el = document.getElementById(section.id);
                if (!el) {
                    continue;
                }
                const box = el.getBoundingClientRect();
                const seen = Math.min(box.bottom, view.bottom) - Math.max(box.top, view.top);
                if (seen > most) {
                    most = seen;
                    current = section.id;
                }
            }
            if (current) {
                setActive(current);
            }
        };

        update();
        scrollEl.addEventListener('scroll', update, {passive: true});
        return () => scrollEl.removeEventListener('scroll', update);
    }, [scrollEl, sections]);

    const go = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        const section = document.getElementById(id);
        if (!scrollEl || !section) {
            return;
        }
        event.preventDefault();
        scrollSectionIntoView(scrollEl, section);
        const heading = section.querySelector<HTMLElement>('h2, h3, [role="heading"]');
        const focusTarget = heading ?? section;
        focusTarget.tabIndex = -1;
        focusTarget.focus({preventScroll: true});
        clickedAt.current = Date.now();
        setActive(id);
    };

    return (
        <nav
            className='pp-sections'
            aria-label={formatMessage(messages.aria)}
        >
            <div className='pp-sections__header'>
                <i className='icon icon-text-box-outline'/>
                <FormattedMessage {...messages.header}/>
            </div>
            {sections.map((section) => {
                const hasError = errorSectionId === section.id;
                return (
                    <a
                        key={section.id}
                        href={`#${section.id}`}
                        className={`pp-sections__item ${active === section.id ? 'pp-sections__item--active' : ''}`}
                        aria-current={active === section.id ? 'true' : undefined}
                        onClick={(event) => go(event, section.id)}
                    >
                        <span>{formatMessage(section.label)}</span>
                        {hasError && (
                            <span className='pp-sections__status'>
                                <AlertCircleOutlineIcon size={16}/>
                                <span className='sr-only'>
                                    <FormattedMessage {...messages.error}/>
                                </span>
                            </span>
                        )}
                    </a>
                );
            })}
        </nav>
    );
}
