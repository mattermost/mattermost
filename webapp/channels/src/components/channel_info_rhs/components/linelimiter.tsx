// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {CSSTransition} from 'react-transition-group';

import styled from 'styled-components';

interface LineLimiterProps {
    children: React.ReactNode;
    maxLines: number;
    lineHeight: number;
    moreText: string;
    lessText: string;
    className?: string;
    errorMargin?: number;
}

const LineLimiterBase = ({children, maxLines, lineHeight, moreText, lessText, errorMargin = 0.1, className}: LineLimiterProps) => {
    const maxLineHeight = maxLines * lineHeight;

    const [needLimiter, setNeedLimiter] = useState(false);
    const [open, setOpen] = useState(false);
    const [maxHeight, setMaxHeight] = useState('inherit');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref === null || ref.current === null) {
            return;
        }

        const contentHeight = ref.current.scrollHeight;
        const margin = maxLineHeight * errorMargin;
        if (contentHeight > (maxLineHeight + margin)) {
            setNeedLimiter(true);

            if (open) {
                setMaxHeight(`${contentHeight}px`);
            } else {
                setMaxHeight(`${maxLineHeight}px`);
            }
        } else {
            setNeedLimiter(false);
            setMaxHeight('inherit');
        }
    }, [children, open]);

    return (
        <CSSTransition
            in={open}
            timeout={500}
            classNames='LineLimiter--Transition-'
        >
            <>
                <div
                    className={className}
                    style={{maxHeight}}
                >
                    <div>
                        <div ref={ref}>{children}</div>
                    </div>
                </div>
                {needLimiter && (
                    <ToggleButton
                        className='LineLimiter__toggler'
                        onClick={() => setOpen(!open)}
                    >
                        {open ? lessText : moreText}
                    </ToggleButton>
                )}
            </>
        </CSSTransition>
    );
};

const ToggleButton = styled.button`
    border: 0px;
    background-color: var(--center-channel-bg);
    color: var(--button-bg);
    padding: 0;
    margin: 0;
`;

const LineLimiter = styled(LineLimiterBase)<LineLimiterProps>`
    transition: max-height 0.5s ease;
    line-height: ${(props) => props.lineHeight}px;
    overflow: hidden;

    p {
        margin-bottom: ${(props) => props.lineHeight}px;
    }

    span[data-emoticon] {
        max-height: ${(props) => props.lineHeight}px;
        .emoticon {
            max-height: ${(props) => props.lineHeight}px;
            min-height: ${(props) => props.lineHeight}px;
         }
    }

    .markdown-inline-img__container img.markdown-inline-img {
        max-height: ${(props) => props.lineHeight}px !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    & > * {
       overflow: hidden;
    }
`;

export default LineLimiter;
