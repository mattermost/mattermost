// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {ModalState} from '../types';
import RadioButtonGroup from 'components/common/radio_group';

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
  const intl = useIntl();
  props.setMode(ModalState.Customize);
  if (props.mode != ModalState.ChannelOnly && props.mode != ModalState.Menu) {
    return null
  }
  return <div>
    <div>
      <RadioButtonGroup
          id='work-template-mode'
          values={[
            {
              key:  intl.formatMessage({
                id: "work_templates.mode.new",
                defaultMessage: "New",
              }),
              value: ModalState.ChannelOnly,
              testId: 'mode-channel',
            },
            {
              key: (
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
              value: ModalState.Menu,
              testId: 'mode-work-template',
            },
          ]}
          value={props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu }
          // badge?: {matchVal: string; badgeContent: ReactNode; extraClass?: string} | undefined | null;
          // sideLegend?: {matchVal: string; text: ReactNode};
          // isDisabled?: null | ((id: string) => boolean);
          onChange={(e) => {props.setMode(e.target.value as ModalState);}}
          testId='work-template-mode-picker'
        />
      <Tourtip/>
    </div>
  </div>
}

const StyledMode = styled(Mode)`
  
`;
export default StyledMode 