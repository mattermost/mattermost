// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import styled from 'styled-components';
import {Scrollbars} from 'react-custom-scrollbars';
import {MenuListComponentProps, OptionTypeBase} from 'react-select';

const MenuListWrapper = styled.div`
    max-height: 280px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background-color: var(--center-channel-bg);
`;

const StyledScrollbars = styled(Scrollbars)`
    height: 300px;
`;

const ThumbVertical = styled.div`
    width: 4px;
    min-height: 45px;
    border-radius: 2px;
    margin-top: 6px;
    margin-left: -2px;
    background-color: rgba(var(--center-channel-color-rgb), 0.24);
`;

const MenuList = <T extends OptionTypeBase>(props: MenuListComponentProps<T, false>) => {
    const renderThumbVertical = useCallback((thumbProps: any) => {
        const thumbPropsWithoutStyle = {...thumbProps};
        Reflect.deleteProperty(thumbPropsWithoutStyle, 'style');
        return <ThumbVertical {...thumbPropsWithoutStyle}/>;
    }, []);

    return (
        <MenuListWrapper>
            <StyledScrollbars
                autoHeight={true}
                renderThumbVertical={renderThumbVertical}
            >
                {props.children}
            </StyledScrollbars>
        </MenuListWrapper>
    );
};

export default MenuList;
