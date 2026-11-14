// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import styled from 'styled-components';

interface Props {
    initialValue?: string;
    onValueChange?: (value: string) => void;
    onBlur?: () => void;
}

const PropertyTextInput = (props: Props) => {
    const [value, setValue] = useState(props.initialValue || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleBlur = () => {
        props.onValueChange?.(value);
        props.onBlur?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            if (e.key === 'Enter') {
                props.onValueChange?.(value);
            }
            props.onBlur?.();
        }
    };

    return (
        <Input
            ref={inputRef}
            type='text'
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder='Enter value...'
        />
    );
};

const Input = styled.input`
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 24px;
    flex: 1;
    padding: 4px 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
    transition: background-color 0.15s ease;

    &:focus {
        outline: none;
        background-color: rgba(var(--button-bg-rgb), 0.12);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

export default PropertyTextInput;