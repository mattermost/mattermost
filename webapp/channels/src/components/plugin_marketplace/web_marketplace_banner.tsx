// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {ArrowRightIcon} from '@mattermost/compass-icons/components';

import pluginIconConfluence from 'images/icons/confluence.svg';
import pluginIconGiphy from 'images/icons/giphy.svg';
import pluginIconPagerDuty from 'images/icons/pager-duty.svg';
import webMarketplaceBannerBackground from 'images/marketplace-notice-background.jpg';

import ExternalLink from '../external_link';

const WEB_MARKETPLACE_LINK = 'https://mattermost.com/marketplace';

const WebMarketplaceBanner = () => {
    const {formatMessage} = useIntl();

    return (
        <WebMarketplaceBannerRoot className='WebMarketplaceBanner'>
            <ExternalBannerLink
                href={WEB_MARKETPLACE_LINK}
                location='marketplace_modal'
            >
                <Title>
                    {formatMessage({id: 'marketplace_modal.web_marketplace_link.title', defaultMessage: 'Discover community integrations'})}
                    <ArrowRightIcon size={24}/>
                </Title>
                <Description>
                    {formatMessage({id: 'marketplace_modal.web_marketplace_link.desc', defaultMessage: 'Connect the tools you use most to Mattermost'})}
                </Description>
                <IconsContainer>
                    <PluginIcon src={pluginIconConfluence}/>
                    <PluginIcon src={pluginIconGiphy}/>
                    <PluginIcon src={pluginIconPagerDuty}/>
                </IconsContainer>
            </ExternalBannerLink>
        </WebMarketplaceBannerRoot>
    );
};

const ExternalBannerLink = styled(ExternalLink)`
    &&,
    &&:hover,
    &&:focus {
        color: var(--denim-center-channel-bg, #FFF);
        text-decoration: none;
    }
    && {
        display: grid;
        grid-template-columns: auto auto;
        justify-content: space-between;
        text-align: left;
        padding: 24px 32px;
    }
`;

const WebMarketplaceBannerRoot = styled.section`
        background-image: url(${webMarketplaceBannerBackground});
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        border-radius: 0 0 12px 12px !important;
        margin: -1px;
`;

const Title = styled.div`
    font-family: Metropolis;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: 24px;
    margin: 4px 0;
    grid-column: 1;

    svg {
        vertical-align: middle;
        display: inline-block;
        margin-left: 4px;
    }
`;

const Description = styled.p`
    font-family: Open Sans;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
    grid-column: 1;
    margin-bottom: 4px;
`;

const PluginIcon = styled.img`
    width: 50px;
    height: 50px;
    border-radius: 50%;
`;

const IconsContainer = styled.div`
    grid-column: 2;
    grid-row: span 2/2;
    ${PluginIcon}:nth-child(n+2) {
        margin-left: calc(-54px / 1/4);
    }
`;

export default WebMarketplaceBanner;
