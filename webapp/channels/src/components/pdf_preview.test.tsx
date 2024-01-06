// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';
import React from 'react';

import PDFPreview from 'components/pdf_preview';
import type {Props} from 'components/pdf_preview';

import {TestHelper} from 'utils/test_helper';

jest.mock('pdfjs-dist', () => ({
    getDocument: () => Promise.resolve({
        numPages: 3,
        getPage: (i: number) => Promise.resolve({
            pageIndex: i,
            getContext: (s: string) => Promise.resolve({s}),
        }),
    }),
}));

describe('component/PDFPreview', () => {
    const requiredProps: Props = {
        fileInfo: TestHelper.getFileInfoMock({extension: 'pdf'}),
        fileUrl: 'https://pre-release.mattermost.com/api/v4/files/ips59w4w9jnfbrs3o94m1dbdie',
        scale: 1,
        handleBgClose: jest.fn(),
    };

    test('should match snapshot, loading', () => {
        const wrapper = shallow(
            <PDFPreview {...requiredProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, not successful', () => {
        const wrapper = shallow(
            <PDFPreview {...requiredProps}/>,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should update state with new value from props when prop changes', () => {
        const wrapper = shallow<PDFPreview>(
            <PDFPreview {...requiredProps}/>,
        );
        const newFileUrl = 'https://some-new-url';

        wrapper.setProps({fileUrl: newFileUrl});
        const {prevFileUrl} = wrapper.instance().state;
        expect(prevFileUrl).toEqual(newFileUrl);
    });

    test('should return correct state when onDocumentLoad is called', () => {
        const wrapper = shallow<PDFPreview>(
            <PDFPreview {...requiredProps}/>,
        );

        let pdf = {numPages: 0} as PDFDocumentProxy;
        wrapper.instance().onDocumentLoad(pdf);
        expect(wrapper.state('pdf')).toEqual(pdf);
        expect(wrapper.state('numPages')).toEqual(pdf.numPages);

        pdf = {
            numPages: 100,
            getPage: async (i) => {
                const page = {pageNumber: i} as PDFPageProxy;
                return Promise.resolve(page);
            },
        } as PDFDocumentProxy;
        wrapper.instance().onDocumentLoad(pdf);
        expect(wrapper.state('pdf')).toEqual(pdf);
        expect(wrapper.state('numPages')).toEqual(pdf.numPages);
    });
});
