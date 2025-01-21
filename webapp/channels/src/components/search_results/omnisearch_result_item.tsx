// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import ExternalLink from 'components/external_link';
import Markdown from 'components/markdown';
import Timestamp from 'components/timestamp';

type Props = {
    icon: string;
    link: string;
    title: string;
    subtitle: string;
    description: string;
    createAt: number;
    source: string;
}

const OmniSearchResultItemContainer = styled.div`
    display: flex;
    padding: 10px;
    border-bottom: 1px solid var(--center-channel-color-08);
    flex-direction: column;
`;

const Body = styled.div`
    display: flex;
    align-items: center;
`;

const Icon = styled.img`
    width: 40px;
    height: 40px;
    margin-right: 10px;
    align-self: flex-start;
    margin-top: 5px;
    border-radius: 20px;
`;

const Title = styled.div`
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 5px;
    a {
        color: var(--center-channel-color);
        text-decoration: none;
        cursor: pointer;
    }
`;

const Subtitle = styled.div`
    font-weight: 400;
    font-size: 14px;
    margin-bottom: 5px;
`;

const Description = styled.div`
    max-height: 100px;
    overflow: hidden;
`;

const Source = styled.div`
    font-weight: 600;
    margin-right: 10px;
`;

const Header = styled.div`
    opacity: 0.73;
    display: flex;
    margin-bottom: 5px;
`;

const OmniSearchResultItem = ({icon, link, title, subtitle, description, createAt, source}: Props) => {
    return (
        <OmniSearchResultItemContainer>
            <Header>
                <Source>{source}</Source>
                <Timestamp value={createAt}/>
            </Header>
            <Body>
                <Icon src={icon}/>
                <div>
                    <Title>
                        <ExternalLink
                            location={'omnisearch'}
                            href={link}
                            rel='noreferrer'
                        >
                            {title}
                        </ExternalLink>
                    </Title>
                    {subtitle && <Subtitle>{subtitle}</Subtitle>}
                    <Description>
                        <Markdown message={description}/>
                    </Description>
                </div>
            </Body>
        </OmniSearchResultItemContainer>
    );
};

export default OmniSearchResultItem;
