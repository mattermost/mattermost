// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {Post} from '@mattermost/types/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from '@mattermost/types/store';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from '@mattermost/types/teams';

import {FormattedMessage} from 'react-intl';

import UpgradeIllustrationSvg from 'src/components/assets/upgrade_illustration_svg';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import PostText from 'src/components/post_text';
import {
    CustomPostButtonRow,
    CustomPostContainer,
    CustomPostContent,
    CustomPostHeader,
} from 'src/components/custom_post_styles';
import {useOpenContactSales} from 'src/hooks';

const StyledTertiaryButton = styled(TertiaryButton)`
    margin-left: 10px;
`;

interface Props {
    post: Post;
}

export const CloudUpgradePost = (props: Props) => {
    const team = useSelector<GlobalState, Team | undefined>((state) => {
        const channel = getChannel(state, props.post.channel_id);

        return channel ? getTeam(state, channel.team_id) : undefined;
    });

    const openContactSales = useOpenContactSales();

    if (!team) {
        return null;
    }

    if (
        !props.post.props.attachments ||
        !Array.isArray(props.post.props.attachments) ||
        props.post.props.attachments.length === 0 ||
        typeof props.post.props.attachments[0]?.text !== 'string'
    ) {
        return null;
    }

    const attachments = props.post.props.attachments[0];

    // Remove the footer (which starts with the Upgrade now link),
    // and the separator, both used as fallback for mobile
    const text = attachments.text.split('[Upgrade now]')[0].replace(/---/g, '');

    return (
        <>
            <StyledPostText
                text={props.post.message}
                team={team}
            />
            <CustomPostContainer>
                <CustomPostContent>
                    <CustomPostHeader>
                        {attachments.title}
                    </CustomPostHeader>
                    <TextBody>
                        {text}
                    </TextBody>
                    <CustomPostButtonRow>
                        <PrimaryButton onClick={openContactSales} >
                            <FormattedMessage defaultMessage='Contact Sales'/>
                        </PrimaryButton>
                        <StyledTertiaryButton
                            onClick={() => window.open('https://mattermost.com/pricing-cloud')}
                        >
                            <FormattedMessage defaultMessage='Learn more'/>
                        </StyledTertiaryButton>
                    </CustomPostButtonRow>
                </CustomPostContent>
                <Image/>
            </CustomPostContainer>
        </>
    );
};

const Image = styled(UpgradeIllustrationSvg)`
    width: 175px;
    height: 106px;
    margin: 16px;
`;

const TextBody = styled.div`
    width: 396px;
    margin-top: 4px;
    margin-bottom: 4px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;
