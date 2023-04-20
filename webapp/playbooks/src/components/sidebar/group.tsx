import React, {useState} from 'react';
import styled, {css} from 'styled-components';

import {setCategoryCollapsed} from 'src/client';

import {SidebarGroup} from './sidebar';
import ItemComponent from './item';
import {PlaybooksCategoryName, RunsCategoryName} from './playbooks_sidebar';

interface GroupProps {
    group: SidebarGroup;
}

const Group = (props: GroupProps) => {
    const [collapsed, setCollapsed] = useState(props.group.collapsed);

    return (
        <GroupContainer data-testid={props.group.id}>
            <Header>
                <HeaderButton
                    aria-label={props.group.display_name}
                    onClick={() => {
                        // Currently Runs category and Playbooks category are automatically generated and
                        // not saved in the DB. So we can't yet save the collapse state for these categories.
                        if (props.group.id !== RunsCategoryName && props.group.id !== PlaybooksCategoryName) {
                            setCategoryCollapsed(props.group.id, !collapsed);
                        }
                        setCollapsed(!collapsed);
                    }}
                >
                    <Chevron
                        className='icon icon-chevron-down'
                        isCollapsed={collapsed}
                    />
                    <HeaderName>
                        {props.group.display_name}
                    </HeaderName>
                </HeaderButton>
            </Header>
            <Body role='list'>
                {props.group.items.map((item) => {
                    const id = item.id ?? item.display_name;
                    return (
                        <ItemComponent
                            key={id}
                            id={id}
                            areaLabel={item.areaLabel}
                            className={item.className}
                            display_name={item.display_name}
                            icon={item.icon}
                            isCollapsed={collapsed}
                            itemMenu={item.itemMenu}
                            link={item.link}
                        />
                    );
                })}
                {props.group.afterGroup}
            </Body>
        </GroupContainer>
    );
};

export default Group;

const Chevron = styled.i<{isCollapsed?: boolean}>`
    ${(props) => props.isCollapsed && css`
        -webkit-transform: rotate(-90deg);
        -ms-transform: rotate(-90deg);
        transform: rotate(-90deg);
        transition: transform 0.15s ease-out; /* should match collapse animation speed */
    `};

    & {
        font-size: 12px;
    }
`;

const GroupContainer = styled.div`
    box-sizing: border-box;
    color: var(--center-channel-color-rgb);
`;

const Header = styled.div`
    z-index: 1;
    top: 0;
    display: flex;
    height: 32px;
    align-items: center;
    border: none;
    background-color: var(--sidebar-bg);
    box-shadow: 0 0 0 0 rgb(0 0 0 / 33%);
    color: rgba(var(--sidebar-text-rgb), 0.6);
    font-family: "Open Sans", sans-serif;
    text-align: left;
    text-overflow: ellipsis;
    text-transform: uppercase;
    transition: box-shadow 0.25s ease-in-out;
`;

const HeaderButton = styled.button`
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    padding: 0;
    border: none;
    background-color: transparent;
    color: rgba(var(--sidebar-text-rgb), 0.6);
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    padding: 6px 20p 6px 4px;
    font-size: 12px;
    font-weight: 600;

    :hover{
        color: var(--sidebar-text);
    }
`;

const Body = styled.ul`
    margin: 0px;
    padding: 0px;
    min-height: 2px;
    margin-bottom: 14px;
`;

const HeaderName = styled.div`
    padding-left: 0;
    overflow: hidden;
    width: 100%;
    flex: 0 1 auto;
    text-overflow: ellipsis;
`;
