// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {HashLink as Link} from 'react-router-hash-link';
import styled, {css} from 'styled-components';

export const Section = styled.section`
    padding: 24px 0;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

type LinkURL = {to: string, name: string};
type LinkHandler = {onClick: () => void, name: string};

function isLinkURL(link: LinkURL | LinkHandler): link is LinkURL {
    return 'to' in link;
}

interface SectionHeaderProps {
    title: string;
    link?: LinkURL | LinkHandler;
}

export const SectionHeader = ({title, link}: SectionHeaderProps) => (
    <SectionHeaderContainer>
        <SectionTitle>{title}</SectionTitle>
        {link && <SectionLink link={link}/>}
    </SectionHeaderContainer>
);

const SectionLink = ({link}: {link: LinkURL | LinkHandler}) => {
    if (isLinkURL(link)) {
        return (
            <StyledLink to={link.to}>
                {link.name}
            </StyledLink>
        );
    }

    return (
        <StyledSpan onClick={link.onClick}>
            {link.name}
        </StyledSpan>
    );
};

const SectionHeaderContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 0 24px;
    margin-bottom: 8px;
`;

const SectionTitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-family: 'Open Sans';
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    text-transform: uppercase;
`;

const LinkStyle = css`
    color: var(--button-bg);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: opacity .2s;

    &:hover{
        text-decoration: underline;
    }
    ${Section}:hover & {
        opacity: 1;
    }
`;

const StyledLink = styled(Link)`
    ${LinkStyle}
`;

const StyledSpan = styled.span`
    ${LinkStyle}
`;
