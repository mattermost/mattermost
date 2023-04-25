// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {HashLink as Link} from 'react-router-hash-link';
import styled, {css} from 'styled-components';

export const Section = styled.section`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 24px 0;
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
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;

    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const LinkStyle = css`
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);
    cursor: pointer;

    :hover{
        text-decoration: underline;
    }

    opacity: 0;
    ${Section}:hover & {
        opacity: 100%;
    }

    transition: opacity .2s;
`;

const StyledLink = styled(Link)`
    ${LinkStyle}
`;

const StyledSpan = styled.span`
    ${LinkStyle}
`;
