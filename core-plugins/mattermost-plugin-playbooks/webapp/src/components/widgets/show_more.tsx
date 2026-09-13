// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {FormattedMessage} from 'react-intl';

import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import {getIsRhsExpanded} from 'src/selectors';

interface CollapsibleProps {
    $isCollapsed: boolean;
}

interface TextContainerProps {
    $isCollapsed: boolean;
    $maxHeight: number;
}

const OuterContainer = styled.div`
    position: relative;
    overflow: hidden;
`;

const TextContainer = styled.div<TextContainerProps>`
    ${(props) => props.$isCollapsed && css`
        max-height: ${props.$maxHeight}px;

        .all-emoji {
            .emoticon {
                min-width: 32px;
                min-height: 32px;
                vertical-align: top;
            }

            .emoticon--unicode {
                font-size: 32px;
                line-height: 1.1;

                .os--windows & {
                    position: relative;
                    left: -4px;
                    font-size: 29px;
                }
            }
        }
    `}
`;

const ShowMoreContainer = styled.div<CollapsibleProps>`
    background: var(--center-channel-bg);
    pointer-events: auto;
    padding-bottom: 10px;
    display: flex;
    justify-content: center;
    width: 100%;

    ${(props) => props.$isCollapsed && css`
        bottom: 10px;
    `}

    ${(props) => !props.$isCollapsed && css`
        position: relative;
        padding-top: 10px;
    `}
`;

const ShowMoreLine = styled.div`
    display: inline-block;
    height: 1px;
    flex-basis: 200px;
    margin-top: 12px;
    background-color: rgba(var(--center-channel-color-rgb), 0.1);
`;

const ShowMoreButton = styled.button`
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    padding: 0 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.1);
    border-radius: 2px;
    margin: 0 8px;
    background: var(--center-channel-bg);
    color: var(--link-color);
    font-size: 13px;
    font-weight: bold;
    line-height: 24px;
    transition: all 0.15s ease;


    &:focus {
        outline: none;
    }

    &:hover {
        background: var(--link-color);
        color: var(--center-channel-bg);
    }
`;

const CollapsibleContainer = styled.div<CollapsibleProps>`
    bottom: 0;
    pointer-events: none;
    position: absolute;
    width: 100%;
    ${(props) => !props.$isCollapsed && css`
        position: relative;
    `}
`;

const CollapsibleGradient = styled.div<CollapsibleProps>`
    position: relative;
    height: ${(props) => (props.$isCollapsed ? '90px' : '0')};
    background: linear-gradient(transparent, var(--center-channel-bg));
`;

interface Props {
    children?: React.ReactNode;
    text?: string;
}

const ShowMore = (props: Props) => {
    const maxHeight = 277;

    const textContainer = useRef<HTMLDivElement>(null);
    const overflowRef = useRef<number>(0);

    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isOverflow, setIsOverflow] = useState(false);

    const isRHSExpanded = useSelector(getIsRhsExpanded);

    const checkTextOverflow = () => {
        if (overflowRef.current) {
            window.cancelAnimationFrame(overflowRef.current);
        }

        if (textContainer.current) {
            setIsOverflow(textContainer.current.scrollHeight > maxHeight);
        }

        overflowRef.current = window.requestAnimationFrame(checkTextOverflow);
    };

    const toggleCollapsed = () => {
        setIsCollapsed((collapsed) => !collapsed);
    };

    useEffect(() => {
        window.addEventListener('resize', checkTextOverflow);
        overflowRef.current = window.requestAnimationFrame(checkTextOverflow);

        return () => {
            window.removeEventListener('resize', checkTextOverflow);
            window.cancelAnimationFrame(overflowRef.current);
        };
    }, []);

    useEffect(() => {
        checkTextOverflow();
    }, [props.text, isRHSExpanded]);

    if (!isOverflow) {
        return (
            <OuterContainer>
                <TextContainer
                    $isCollapsed={isCollapsed}
                    $maxHeight={maxHeight}
                    ref={textContainer}
                >
                    {props.children}
                </TextContainer>
            </OuterContainer>
        );
    }

    let showIcon = <ChevronUpIcon color={'currentColor'}/>;
    let showText = <FormattedMessage defaultMessage='Show less'/>;
    if (isCollapsed) {
        showIcon = <ChevronDownIcon color={'currentColor'}/>;
        showText = <FormattedMessage defaultMessage='Show more'/>;
    }

    return (
        <OuterContainer>
            <TextContainer
                $isCollapsed={isCollapsed}
                $maxHeight={maxHeight}
                ref={textContainer}
            >
                {props.children}
            </TextContainer>
            <CollapsibleContainer $isCollapsed={isCollapsed}>
                <CollapsibleGradient $isCollapsed={isCollapsed}/>
                <ShowMoreContainer $isCollapsed={isCollapsed}>
                    <ShowMoreLine/>
                    <ShowMoreButton onClick={toggleCollapsed}>
                        {showIcon}
                        {showText}
                    </ShowMoreButton>
                    <ShowMoreLine/>
                </ShowMoreContainer>
            </CollapsibleContainer>
        </OuterContainer>
    );
};

export default ShowMore;
