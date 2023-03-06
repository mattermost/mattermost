// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {
    HTMLAttributes,
    memo,
    useCallback,
    useEffect,
    useState,
} from 'react';
import {FormattedMessage} from 'react-intl';

import {useLocation} from 'react-router-dom';

import {TextBoxOutlineIcon} from '@mattermost/compass-icons/components';

import {telemetryEventForPlaybook} from 'src/client';
import {BackstageID} from 'src/components/backstage/backstage';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {useScrollListener} from 'src/hooks';

interface Props {
    playbookId: PlaybookWithChecklist['id'];
    items: Array<{id: string; title: string;}>;
}

type ItemId = Props['items'][number]['id'];

type Attrs = HTMLAttributes<HTMLElement>;

// Height of the headers in pixels
const headersOffset = 140;

const ScrollNav = ({playbookId, items, ...attrs}: Props & Attrs) => {
    const {hash} = useLocation();
    const [activeId, setActiveId] = useState(items?.[0].id);

    const updateActiveSection = useCallback(() => {
        const threshold = (window.innerHeight / 2) - headersOffset;

        let finalId: ItemId | null = null;
        let finalPos = Number.NEGATIVE_INFINITY;

        // Get the section whose top border is over the middle of the window (the threshold) and closer to it.
        items.forEach(({id}) => {
            const top = document.getElementById(id)?.getBoundingClientRect().top || Number.POSITIVE_INFINITY;
            const pos = top - headersOffset;

            if (pos < threshold && pos > finalPos) {
                finalId = id;
                finalPos = pos;
            }
        });

        if (finalId !== null) {
            setActiveId(finalId);
        }
    }, []);

    const root = document.getElementById(BackstageID);

    useEffect(updateActiveSection, []);
    useScrollListener(root, updateActiveSection);

    const scrollToSection = useCallback((id: ItemId) => {
        telemetryEventForPlaybook(playbookId, `playbook_preview_navbar_section_${id}_clicked`);

        if (activeId === id) {
            return;
        }

        const section = document.getElementById(id);

        if (!section || !root) {
            return;
        }

        const amount = section.getBoundingClientRect().top - headersOffset;

        // If there is no need to scroll, simply set the section item as active
        const reachedTop = root.scrollTop === 0;
        const reachedBottom = root.scrollHeight - Math.abs(root.scrollTop) === root.clientHeight;
        if ((amount > 0 && reachedBottom) || (amount < 0 && reachedTop) || amount === 0) {
            setActiveId(id);
            return;
        }

        root.scrollBy({
            top: amount,
            behavior: 'smooth',
        });

        // At this point, we know we are certain scrollBy will generate an actual scroll,
        // so we can listen to the 'scroll' event that was fired because of scrollBy
        // and set the active ID only when it's finished.
        // This is needed because short sections at the bottom may be positioned below
        // the middle of the window, so we need to wait for the scroll event to finish
        // and manually mark the section as active, instead of relying on the automatic
        // updateActiveSection.
        let timer: NodeJS.Timeout;
        const callback = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                setActiveId(id);
                root.removeEventListener('scroll', callback);
            }, 150);
        };

        root.addEventListener('scroll', callback, {passive: true});
    }, [activeId]);

    useEffect(() => {
        const sectionHash = hash.substring(1);
        if (items.some(({id}) => id === sectionHash)) {
            scrollToSection(sectionHash);
        }
    }, [hash]);

    return (
        <Wrapper
            id='playbook-preview-navbar'
            {...attrs}
        >
            <Header>
                <TextBoxOutlineIcon size={16}/>
                <FormattedMessage defaultMessage='Contents'/>
            </Header>
            <Items>
                {items.map(({id, title}) => (
                    <Item
                        key={id}
                        active={activeId === id}
                        onClick={() => scrollToSection(id)}
                    >
                        {title}
                    </Item>
                ))}
            </Items>
        </Wrapper>
    );
};

const Wrapper = styled.nav`

`;

const Header = styled.div`
    height: 32px;
    text-transform: uppercase;

    font-weight: 600;
    font-size: 12px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.56);

    padding-left: 12px;
    padding-top: 4px;

    margin-bottom: 8px;

    display: flex;
    align-items: center;
    gap: .75rem;
`;

const Items = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
`;

const Item = styled.div<{active: boolean}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 12px;
    padding-right: 30px;
    cursor: pointer;

    border-radius: 4px;

    margin: 0;

    :not(:last-child) {
        margin-bottom: 8px;
    }

    font-weight: 400;
    font-size: 14px;
    line-height: 14px;

    background: transparent;
    color: var(--center-channel-color);

    ${({active}) => active && css`
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    `}

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

export default memo(ScrollNav);
