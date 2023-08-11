// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import {mount} from 'enzyme';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import LocalizedInput from './localized_input';

describe('components/localized_input/localized_input', () => {
    const baseProps = {
        className: 'test-class',
        onChange: jest.fn(),
        placeholder: {id: 'test.placeholder', defaultMessage: 'placeholder to test'},
        value: 'test value',
    };

    test('should match snapshot', () => {
        const wrapper = mount(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <LocalizedInput {...baseProps}/>
            </IntlProvider>,
        ).childAt(0);

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('input').length).toBe(1);
        expect(wrapper.find('input').get(0).props.value).toBe('test value');
        expect(wrapper.find('input').get(0).props.className).toBe('test-class');
        expect(wrapper.find('input').get(0).props.placeholder).toBe('placeholder to test');
    });

    it('ref should properly be forwarded', () => {
        const ref = React.createRef<HTMLInputElement>();
        const props = {
            ...baseProps,
            ref,
        };

        const wrapper = mountWithIntl(
            <IntlProvider
                locale='en'
                messages={{}}
            >
                <LocalizedInput {...props}/>
            </IntlProvider>,
        );

        expect(ref.current).toBe(wrapper.find('input').instance());
    });
});
