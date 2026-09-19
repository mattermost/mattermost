// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AutosizeTextarea from 'components/autosize_textarea';

import {render, screen} from 'tests/react_testing_utils';

describe('components/AutosizeTextarea', () => {
    test('should match snapshot, init', () => {
        const {container} = render(
            <AutosizeTextarea/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should disable the textarea itself rather than the hidden measuring div', () => {
        const {container} = render(
            <AutosizeTextarea disabled={true}/>,
        );

        expect(screen.getByTestId('autosize_textarea')).toBeDisabled();
        expect(container.querySelector('#autosize_textarea-reference')).not.toHaveAttribute('disabled');
    });
});
