// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import NotLoggedIn from 'components/header_footer_template/header_footer_template';

describe('components/HeaderFooterTemplate', () => {
    const RealDate: DateConstructor = Date;

    function mockDate(date: Date) {
        function mock() {
            return new RealDate(date);
        }
        mock.now = () => date.getTime();
        global.Date = mock as any;
    }

    beforeEach(() => {
        mockDate(new Date(2017, 6, 1));

        const elm = document.createElement('div');
        elm.setAttribute('id', 'root');
        document.body.appendChild(elm);
        document.body.classList.remove('sticky');
    });

    afterEach(() => {
        global.Date = RealDate;
    });

    test('should match snapshot without children', () => {
        const wrapper = shallow(
            <NotLoggedIn config={{}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const wrapper = shallow(
            <NotLoggedIn config={{}}>
                <p>{'test'}</p>
            </NotLoggedIn>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with help link', () => {
        const wrapper = shallow(
            <NotLoggedIn config={{HelpLink: 'http://testhelplink'}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with term of service link', () => {
        const wrapper = shallow(
            <NotLoggedIn config={{TermsOfServiceLink: 'http://testtermsofservicelink'}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with privacy policy link', () => {
        const wrapper = shallow(
            <NotLoggedIn config={{PrivacyPolicyLink: 'http://testprivacypolicylink'}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with about link', () => {
        const wrapper = shallow(
            <NotLoggedIn config={{AboutLink: 'http://testaboutlink'}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with all links', () => {
        const wrapper = shallow(
            <NotLoggedIn
                config={{
                    HelpLink: 'http://testhelplink',
                    TermsOfServiceLink: 'http://testtermsofservicelink',
                    PrivacyPolicyLink: 'http://testprivacypolicylink',
                    AboutLink: 'http://testaboutlink',
                }}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should set classes on body and #root on mount', () => {
        expect(document.body.classList.contains('sticky')).toBe(false);
        const rootElement: HTMLElement | null = document.getElementById('root');
        expect(rootElement?.classList?.contains('container-fluid')).toBe(true);
        shallow(<NotLoggedIn config={{AboutLink: 'http://testaboutlink'}}/>);
        expect(document.body.classList.contains('sticky')).toBe(true);
        expect(rootElement?.classList?.contains('container-fluid')).toBe(true);
    });

    test('should unset classes on body and #root on unmount', () => {
        expect(document.body.classList.contains('sticky')).toBe(false);
        const rootElement: HTMLElement | null = document.getElementById('root');
        expect(rootElement?.classList?.contains('container-fluid')).toBe(true);
        const wrapper = shallow(
            <NotLoggedIn config={{AboutLink: 'http://testaboutlink'}}/>,
        );
        expect(document.body.classList.contains('sticky')).toBe(true);
        expect(rootElement?.classList?.contains('container-fluid')).toBe(true);
        wrapper.unmount();
        expect(document.body.classList.contains('sticky')).toBe(false);
        expect(rootElement?.classList?.contains('container-fluid')).toBe(false);
    });
});
