// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        background-color: var(--center-channel-bg);
        border-radius: 4px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        width: ${(props) => (props.width ? props.width : '360px')};
        height: 4rem;
        font-size: 14px;
        padding-left: 4rem;

        &:focus {
            box-shadow: inset 0 0 0 1px var(--button-bg);
            border-color: var(--button-bg);
        }
    }

    &:before {
        left: 16px;
        top: 8px;
        position: absolute;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        content: '\\f0349';
        font-size: 18px;
        font-family: 'compass-icons', mattermosticons;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
`;

const ClearButton = styled.i`
    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ClearButtonContainer = styled.div`
    display: flex;
    position: absolute;
    right: 10px;
    top: 0px;
    height: 100%;
    align-items: center;
`;
