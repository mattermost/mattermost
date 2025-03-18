// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {css} from 'styled-components';
import styled from 'styled-components';

import type {InputProps} from 'components/widgets/inputs/input/input';
import Input from 'components/widgets/inputs/input/input';

export interface Props extends InputProps {
    type: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
    customStyles?: ReturnType<typeof css>;
}

export function MenuItemInput(props: Props) {
    const {
        type,
        customStyles,
        onChange,
        ...otherProps
    } = props;

    const changeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (onChange) {
            onChange(event);
        }
    };

    const stopParentFromCapturingKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
    };

    return (
        <Container $customStyles={customStyles}>
            <Input
                type={type}
                onChange={changeHandler}
                onKeyUp={stopParentFromCapturingKey}
                onKeyDown={stopParentFromCapturingKey}
                {...otherProps}
            />
        </Container>
    );
}

const Container = styled.div<{$customStyles?: ReturnType<typeof css>}>`
    padding: 10px;
    ${({$customStyles}) => $customStyles};
`;
