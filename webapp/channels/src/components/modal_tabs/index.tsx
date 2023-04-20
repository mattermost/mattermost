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
  return <div>
    'ASDF ASDF ASDF'
    {
      props.tabs.map((tab) => (
        <Tab key={tab.key} onClick={tab.onClick} data-testid={tab.testId} selected={tab.key === props.selected}>
          {tab.content}
        </Tab>
      ))
    }
  </div>
}


interface TabStyles {
  selected: boolean;
}

const Tab = styled.div<TabStyles>`
  padding: 10px;
  background: ${props => props.selected ? "palevioletred" : "white"};
`;
