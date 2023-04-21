// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import styled from 'styled-components';

interface Tab {
  key: string;
  content: React.ReactNode | React.ReactNodeArray
  onClick: () => void;
  testId?: string;
}
interface Props {
  tabs: Tab[];
  startKey?: string;
  selected: string;
}
export default function ModalTabs( props: Props ) {
  return <TabContainer>
    {
      props.tabs.map((tab) => (
        <Tab
          key={tab.key}
          onClick={tab.onClick}
          data-testid={tab.testId}
          selected={tab.key === props.selected}
        >
          {tab.content}
        </Tab>
      ))
    }
  </TabContainer>
}


interface TabStyles {
  selected: boolean;
}

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 32px;
`

const Tab = styled.div<TabStyles>`
  padding: 13px 8px;
  position: relative;
  font-weight: 600;
  font-size: 12px;
  line-height: 16px;
  color: ${props => props.selected ? 'var(--link-color)' : 'rgba(var(--center-channel-text-rgb), 064)'};

  &:after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: ${props => props.selected ? 'var(--link-color)' : ''};
  }
`;
