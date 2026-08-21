// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    testId: string;
    default: string | undefined;
    onSearch: (term: string) => void;
    placeholder: string;
    width?: string;
}

export default function SearchInput(props: Props) {
    const {formatMessage} = useIntl();

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTerm(event.target.value);
        props.onSearch(event.target.value);
    };

    const [term, setTerm] = useState(props.default ? props.default : '');
    const shouldShowClearIcon = term !== '';

    return (
        <Search
            data-testid={props.testId}
            width={props.width}
        >
            <input
                type='text'
                placeholder={props.placeholder}
                onChange={onChange}
                value={term}
            />
            {shouldShowClearIcon && (
                <Tooltip
                    id={'clear'}
                    placement={'bottom'}
                    content={formatMessage({defaultMessage: 'Clear'})}
                >
                    <ClearButtonContainer>
                        <ClearButton
                            className='icon-close-circle'
                            onClick={() => {
                                setTerm('');
                                props.onSearch('');
                            }}
                        />
                    </ClearButtonContainer>
                </Tooltip>

            )}
        </Search>
    );
}

export const Search = styled.div<{width?: string}>`
    position: relative;
    font-weight: 400;

    input {
        width: ${(props) => (props.width ? props.width : '360px')};
        height: 4rem;
        padding-left: 4rem;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        border-radius: 4px;
        background-color: var(--center-channel-bg);
        font-family: 'Open Sans', sans-serif;
        font-size: 14px;
        transition: all 0.15s ease;
        transition-delay: 0s;

        &:focus {
            border-color: var(--button-bg);
            box-shadow: inset 0 0 0 1px var(--button-bg);
        }
    }

    &::before {
        position: absolute;
        top: 7px;
        left: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        content: '\\f0349';
        font-family: compass-icons, mattermosticons;
        font-size: 18px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
`;

const ClearButton = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 18px;
`;

const ClearButtonContainer = styled.div`
    position: absolute;
    top: 0;
    right: 10px;
    display: flex;
    height: 100%;
    align-items: center;
`;
