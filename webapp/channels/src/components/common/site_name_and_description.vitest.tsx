// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import SiteNameAndDescription from 'components/common/site_name_and_description';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('/components/common/SiteNameAndDescription', () => {
    const baseProps = {
        customDescriptionText: '',
        siteName: 'Mattermost',
    };

    test('should match snapshot, default', () => {
        const {container} = renderWithContext(<SiteNameAndDescription {...baseProps}/>);
        expect(container).toMatchSnapshot();
        expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(baseProps.siteName);
    });

    test('should match snapshot, with custom site name and description', () => {
        const props = {...baseProps, customDescriptionText: 'custom_description_text', siteName: 'other_site'};
        const {container} = renderWithContext(<SiteNameAndDescription {...props}/>);

        expect(container).toMatchSnapshot();
        expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(props.siteName);
        expect(screen.getByRole('heading', {level: 3})).toHaveTextContent(props.customDescriptionText);
    });
});
