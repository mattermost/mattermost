// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState} from 'react';
import styled from 'styled-components';

const Filter = styled.input`
    width: 70%;
    height: 80%;
    margin-left: 8px;
    border-radius: 4px;
    border: 0;
    background: border-box;
    color: ${({error}: {error: boolean}) => {
        return error ? 'rgb(var(--semantic-color-danger))' : 'var(--sidebar-text)';
    }};
`;

type Props = {
    onChange: (regex: RegExp) => void;
}

function Input({onChange}: Props) {
    const [error, setError] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        try {
            const rg = new RegExp(e.target.value, 'gi');
            setError(false);
            onChange(rg);
        } catch (e) {
            setError(true);
        }
    }

    return (
        <Filter
            error={error}
            placeholder='/ filter by regular expression /'
            onChange={handleChange}
        />
    );
}

export default memo(Input);
