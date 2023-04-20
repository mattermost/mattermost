// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {ModalState} from '../types';
import Tabs from 'components/modal_tabs';

function Tourtip() {
  const intl = useIntl();
  
  return (<div>

  {intl.formatMessage({id: "work_templates.mode.tourtip_title", defaultMessage: "Try one of our templates",})}
  {intl.formatMessage({id: "work_templates.mode.tourtip_what", defaultMessage: "Our templates cover a variety of use cases and include critical tools.",})}
  {intl.formatMessage({id: "work_templates.mode.tourtip_why", defaultMessage: "Use them to define your channel's purpose and set your team up for success.",})}
  {intl.formatMessage({id: "work_templates.mode.tourtip_cta", defaultMessage: "Select a template",})}
  </div>);
}

interface Props {
  mode: ModalState;
  setMode: (mode: ModalState) => void;
}
function Mode(props: Props) {
  const [originalMode] = useState(props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu);
  const currentMode = props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu;
  const intl = useIntl();
  if (props.mode != ModalState.ChannelOnly && props.mode != ModalState.Menu) {
    return null
  }
  return <div>
    <div>
      <Tabs
          tabs={[
            {
              content:  intl.formatMessage({
                id: "work_templates.mode.new",
                defaultMessage: "New",
              }),
              onClick: () => props.setMode(ModalState.ChannelOnly),
              key: ModalState.ChannelOnly,
              testId: 'mode-channel',
            },
            {
              content: (
                <div>
                  {intl.formatMessage({
                    id: "work_templates.mode.templates",
                    defaultMessage: "Templates",
                  })}
                <span>
                  {intl.formatMessage({
                    id: "work_templates.mode.templates_new",
                    defaultMessage: "New",
                  })}
                </span>
                </div>
              ),
              onClick: () => props.setMode(ModalState.Menu),
              testId: 'mode-work-template',
              key: ModalState.Menu,
            },
          ]}
          startKey={originalMode}
          selected={currentMode}
        />
      <Tourtip/>
    </div>
  </div>
}

const StyledMode = styled(Mode)`
  
`;
export default StyledMode 