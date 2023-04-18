// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

interface Props {
  tryTemplates: () => void;
}
function ChannelOnly(props: Props) {
  const intl = useIntl();
  return <div>
      {'aside here'}
      {intl.formatMessage({
        id: "work_templates.channel_only.what",
        defaultMessage: "Channels allow you to organize conversations, tasks and content in one convenient place.",
      })}
    <button onClick={() => {props.tryTemplates()}}>
      {intl.formatMessage({
        id: "work_templates.channel_only.try_template",
        defaultMessage: "Try a template",
      })}
    </button>
    </div>
}

const StyledChannelOnly = styled(ChannelOnly)`
  
`;
export default StyledChannelOnly