// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render} from '@testing-library/react';

import AutosizeTextarea from 'components/autosize_textarea';

describe('components/AutosizeTextarea', () => {
    test('should render textarea with default props', () => {
        render(<AutosizeTextarea/>);

        const textarea = screen.getByTestId('autosize_textarea');
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveAttribute('role', 'textbox');
        expect(textarea).toHaveAttribute('dir', 'auto');
    });

    test('should render textarea with custom id and placeholder', () => {
        const props = {
            id: 'custom_id',
            placeholder: 'Type something',
        };

        render(<AutosizeTextarea {...props}/>);

        const textarea = screen.getByTestId('custom_id');
        const placeholder = screen.getByTestId('custom_id_placeholder');
        
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveAttribute('id', 'custom_id');
        expect(textarea).toHaveAttribute('aria-label', 'type something');
        
        expect(placeholder).toBeInTheDocument();
        expect(placeholder).toHaveTextContent('Type something');
    });
});
