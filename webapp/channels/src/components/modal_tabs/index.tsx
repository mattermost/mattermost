// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

interface Tab {
    key: string;
    content: React.ReactNode | React.ReactNodeArray;
    onClick: () => void;
    testId?: string;
    id?: string;
}
interface Props {
    tabs: Tab[];
    startKey?: string;
    selected: string;
    padding?: string;
    underline?: boolean;
    underlineLeft?: string;
    underlineWidth?: string;
    extraSpacing?: string;
}
export default function ModalTabs(props: Props) {
    return (
        <TabContainer
            underline={props.underline}
            padding={props.padding}
            underlineLeft={props.underlineLeft}
            underlineWidth={props.underlineWidth}
            extraSpacing={props.extraSpacing}
        >
            {
                props.tabs.map((tab) => (
                    <Tab
                        key={tab.key}
                        onClick={tab.onClick}
                        data-testid={tab.testId}
                        selected={tab.key === props.selected}
                        id={tab.id}
                    >
                        {tab.content}
                    </Tab>
                ))
            }
        </TabContainer>
    );
}

interface ContainerStyles {
    padding?: string;
    underline?: boolean;
    underlineLeft?: string;
    underlineWidth?: string;
    extraSpacing?: string;
}
const TabContainer = styled.div<ContainerStyles>`
  display: flex;
  position: relative;
  &:after {
    content: '';
    height: 1px;
    width: ${(props) => (props.underlineWidth ? props.underlineWidth : '100%')};
    position: absolute;
    background-color: rgba(var(--center-channel-text-rgb), 0.16);
    top: 100%;
    left: ${(props) => (props.underlineLeft ? props.underlineLeft : '0')};
  }

  ${(props) => (props.extraSpacing ? `margin-bottom: ${props.extraSpacing};` : '')}
  ${(props) => (props.padding ? ('padding: ' + props.padding + ';') : '')}
`;

interface TabStyles {
    selected: boolean;
}
const Tab = styled.div<TabStyles>`
  padding: 13px 8px;
  cursor: pointer;
  position: relative;
  font-weight: 600;
  font-size: 12px;
  line-height: 16px;
  color: ${(props) => (props.selected ? 'var(--link-color)' : 'rgba(var(--center-channel-text-rgb), 0.64)')};

  &:after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: ${(props) => (props.selected ? 'var(--link-color)' : '')};
  }
`;
