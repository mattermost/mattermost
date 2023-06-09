import React, {useCallback} from 'react';

import styled from 'styled-components';
import {Scrollbars} from 'react-custom-scrollbars';
import {MenuListComponentProps, OptionTypeBase} from 'react-select';

const MenuListWrapper = styled.div`
    background-color: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;

    max-height: 280px;
`;

const StyledScrollbars = styled(Scrollbars)`
    height: 300px;
`;

const ThumbVertical = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.24);
    border-radius: 2px;
    width: 4px;
    min-height: 45px;
    margin-left: -2px;
    margin-top: 6px;
`;

const MenuList = <T extends OptionTypeBase>(props: MenuListComponentProps<T, false>) => {
    const renderThumbVertical = useCallback((thumbProps) => {
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
