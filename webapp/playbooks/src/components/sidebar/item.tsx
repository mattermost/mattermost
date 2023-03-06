import React from 'react';
import {NavLink} from 'react-router-dom';
import classNames from 'classnames';

import styled, {css} from 'styled-components';

import Tooltip from 'src/components/widgets/tooltip';

import {DotMenuButton} from 'src/components/dot_menu';

interface ItemProps {
    icon: string;
    itemMenu?: React.ReactNode;
    id: string;
    display_name: string;
    className: string;
    areaLabel: string;
    link: string;
    isCollapsed: boolean;
}

const Item = (props: ItemProps) => {
    return (
        <ItemContainer
            isCollapsed={props.isCollapsed}
            data-testid={props.display_name}
        >
            {!props.isCollapsed &&
                <StyledNavLink
                    className={props.className}
                    id={`sidebarItem_${props.id}`}
                    aria-label={props.areaLabel}
                    to={props.link}
                >
                    <Tooltip
                        id={`sidebarTooltip_${props.id}`}
                        content={props.display_name}
                    >
                        <NameIconContainer
                            id={`sidebarItem_${props.id}`}
                        >
                            <Icon className={classNames('CompassIcon', props.icon)}/>
                            <ItemDisplayLabel>
                                {props.display_name}
                            </ItemDisplayLabel>
                        </NameIconContainer>
                    </Tooltip>
                    {<HoverMenu>{props.itemMenu}</HoverMenu>}
                </StyledNavLink>
            }
        </ItemContainer>
    );
};

export const ItemDisplayLabel = styled.span`
    max-width: 100%;
    height: 18px;
    line-height: 18px;
    text-align: justify;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
`;

export const Icon = styled.i`
    font-size: 18px;
    margin: 0 6px 0 -2px
`;

export const ItemContainer = styled.li<{isCollapsed?: boolean}>`
    display: flex;

    height: 32px;
    align-items: center;
    list-style-type: none;
    transition: height 0.18s ease;

    ${(props) => props.isCollapsed && css`
        height: 0px;
    `};
`;

export const StyledNavLink = styled(NavLink)`
    &&& {
        position: relative;
        display: flex;
        width: 240px;
        height: 32px;
        align-items: center;
        padding: 7px 16px 7px 19px;
        border-top: 0;
        border-bottom: 0;
        margin-right: 0;
        color: rgba(var(--sidebar-text-rgb), 0.72);
        font-size: 14px;
        text-decoration: none;

        :hover,
        :focus {
            text-decoration: none;
        }

        :hover,
        :focus-visible {
            background: var(--sidebar-text-hover-bg);
        }

        &.active {
            color: rgba(var(--sidebar-text-rgb), 1);
            background: rgba(var(--sidebar-text-rgb), 0.16);
            ::before {
                position: absolute;
                top: 0;
                left: -2px;
                width: 4px;
                height: 100%;
                background: var(--sidebar-text-active-border);
                border-radius: 4px;
                content: "";
            }
        }

        ${DotMenuButton} {
            opacity: 0;
        }
        &:hover {
            padding-right: 32px;
            ${DotMenuButton} {
                opacity: 1;
            }
        }
    }
`;

const HoverMenu = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    position: absolute;
    right: 8px;
`;

const NameIconContainer = styled.div`
    display: flex;
    align-items: center;
    overflow: hidden;
`;

export default Item;
