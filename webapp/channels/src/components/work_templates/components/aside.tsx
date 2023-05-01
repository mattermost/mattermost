// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

const genericModalSidePadding = '32px';
import TeamConversationSvg from 'components/common/svg_images_components/team_conversation_svg';

const ChannelsUse = styled.div`
  color: var(--center-channel-text);
  padding: 20px 0;
`;

const StyledAside = styled.div`
    text-align: center;
    flex-shrink: 0;
    flex-grow: 0;
    width: 260px;
    padding: ${genericModalSidePadding};
    background-color: rgba(var(--center-channel-text-rgb), 0.04);

    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;

    @media (max-width: 800px) {
      display: none;
    }
`;

const TryTemplate = styled.a`
  color: var(--button-bg);
  font-weight: 600;
  font-size 12px;
  background-color: unset;
  &:hover, &:focus {
    text-decoration: none;
  }
`;

interface Props {
    tryTemplates: () => void;
}

export default function Aside(props: Props) {
    const intl = useIntl();
    return (
        <StyledAside>
            <div>
                <TeamConversationSvg/>
            </div>
            <ChannelsUse>
                {intl.formatMessage({
                    id: 'work_templates.channel_only.what',
                    defaultMessage: 'Channels allow you to organize conversations, tasks and content in one convenient place.',
                })}
            </ChannelsUse>
            <TryTemplate
                onClick={props.tryTemplates}
                id='work-templates-try-templates-aside'
            >
                {intl.formatMessage({
                    id: 'work_templates.channel_only.try_template',
                    defaultMessage: 'Try a template',
                })}
            </TryTemplate>
        </StyledAside>
    );
}
