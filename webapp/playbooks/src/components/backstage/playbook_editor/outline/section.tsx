// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React from 'react';
import {useRouteMatch} from 'react-router-dom';

import CopyLink from 'src/components/widgets/copy_link';
import {getSiteUrl} from 'src/client';

interface Props {
    id: string;
    title: string;
    children?: React.ReactNode;
    headerRight?: React.ReactNode;
    hoverEffect?: boolean;
    onHeaderClick?: () => void;
    hasSubtitle?: boolean;
}

const Section = ({
    id,
    title,
    headerRight,
    children,
    hoverEffect,
    onHeaderClick,
    hasSubtitle,
}: Props) => {
    const {url} = useRouteMatch();

    return (
        <Wrapper
            id={id}
        >
            <Header
                $clickable={Boolean(onHeaderClick)}
                $hasSubtitle={hasSubtitle}
                $hoverEffect={hoverEffect}
                onClick={onHeaderClick}
            >
                <Title>
                    <CopyLink
                        id={`section-link-${id}`}
                        to={getSiteUrl() + `${url}#${id}`}
                        name={title}
                        area-hidden={true}
                    />
                    {title}
                </Title>
                {headerRight && (
                    <HeaderRight>
                        {headerRight}
                    </HeaderRight>
                )}
            </Header>
            {children}
        </Wrapper>
    );
};

const Wrapper = styled.div`
    padding: 0.5rem 3rem 2rem;
`;

const Header = styled.div<{ $clickable?: boolean; $hoverEffect?: boolean; $hasSubtitle?: boolean; $hideHeaderRight?: boolean; }>`
    ${({$clickable}) => $clickable && css`
        cursor: pointer;
    `}
    ${({$hoverEffect}) => $hoverEffect && css`
        ${HeaderRight} {
            opacity: 0
        }
        :hover,
        :focus-within {
            background: rgba(var(--center-channel-color-rgb), 0.04);
            ${HeaderRight} {
                opacity: 1;
            }
        }
    `}
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20px;
    margin-bottom: ${({$hasSubtitle}) => ($hasSubtitle ? '2px' : '10px')};
    padding: 4px 0 4px 8px;
`;

const HeaderRight = styled.div``;

const Title = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    white-space: nowrap;
    margin: 0;
    position: relative;

    ${CopyLink} {
        margin-left: -1.25em;
        opacity: 1;
        transition: opacity ease 0.15s;
        position: absolute;
        left: -10px;
    }

    &:not(:hover) ${CopyLink}:not(:hover) {
        opacity: 0;
    }
`;

export default Section;
