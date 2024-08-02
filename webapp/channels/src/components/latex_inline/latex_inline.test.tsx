// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import LatexInline from 'components/latex_inline/latex_inline';

describe('components/LatexBlock', () => {
    const defaultProps = {
        content: 'e^{i\\pi} + 1 = 0',
        enableInlineLatex: true,
    };

    test('should match snapshot', async () => {
        const wrapper = shallow(<LatexInline {...defaultProps}/>);
        await import('katex'); //manually import katex
        expect(wrapper).toMatchSnapshot();
    });

    test('latex is disabled', async () => {
        const props = {
            ...defaultProps,
            enableInlineLatex: false,
        };

        const wrapper = shallow(<LatexInline {...props}/>);
        await import('katex'); //manually import katex
        expect(wrapper).toMatchSnapshot();
    });

    test('error in katex', async () => {
        const props = {
            content: 'e^{i\\pi + 1 = 0',
            enableInlineLatex: true,
        };

        const wrapper = shallow(<LatexInline {...props}/>);
        await import('katex'); //manually import katex
        expect(wrapper).toMatchSnapshot();
    });
});
