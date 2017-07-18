// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FileInfoPreview from './file_info_preview.jsx';

import loadingGif from 'images/load.gif';

import PropTypes from 'prop-types';

import React from 'react';
import PDFJS from 'pdfjs-dist';
import {FormattedMessage} from 'react-intl';

const MAX_PDF_PAGES = 5;

export default class PDFPreview extends React.Component {
    constructor(props) {
        super(props);

        this.updateStateFromProps = this.updateStateFromProps.bind(this);
        this.onDocumentLoad = this.onDocumentLoad.bind(this);
        this.onPageLoad = this.onPageLoad.bind(this);
        this.renderPDFPage = this.renderPDFPage.bind(this);

        this.pdfPagesRendered = {};

        this.state = {
            pdf: null,
            pdfPages: {},
            pdfPagesLoaded: {},
            numPages: 0,
            loading: true,
            success: false
        };
    }

    componentDidMount() {
        this.updateStateFromProps(this.props);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.fileUrl !== nextProps.fileUrl) {
            this.updateStateFromProps(nextProps);
            this.pdfPagesRendered = {};
        }
    }

    componentDidUpdate() {
        if (this.state.success) {
            for (let i = 0; i < this.state.numPages; i++) {
                this.renderPDFPage(i);
            }
        }
    }

    renderPDFPage(pageIndex) {
        if (this.pdfPagesRendered[pageIndex] || !this.state.pdfPagesLoaded[pageIndex]) {
            return;
        }

        const canvas = this.refs['pdfCanvas' + pageIndex];
        const context = canvas.getContext('2d');
        const viewport = this.state.pdfPages[pageIndex].getViewport(1);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport
        };

        this.state.pdfPages[pageIndex].render(renderContext);
        this.pdfPagesRendered[pageIndex] = true;
    }

    updateStateFromProps(props) {
        this.setState({
            pdf: null,
            pdfPages: {},
            pdfPagesLoaded: {},
            numPages: 0,
            loading: true,
            success: false
        });

        PDFJS.getDocument(props.fileUrl).then(this.onDocumentLoad);
    }

    onDocumentLoad(pdf) {
        const numPages = pdf.numPages <= MAX_PDF_PAGES ? pdf.numPages : MAX_PDF_PAGES;
        this.setState({pdf, numPages});
        for (let i = 1; i <= pdf.numPages; i++) {
            pdf.getPage(i).then(this.onPageLoad);
        }
    }

    onPageLoad(page) {
        const pdfPages = Object.assign({}, this.state.pdfPages);
        pdfPages[page.pageIndex] = page;

        const pdfPagesLoaded = Object.assign({}, this.state.pdfPagesLoaded);
        pdfPagesLoaded[page.pageIndex] = true;

        this.setState({pdfPages, pdfPagesLoaded});

        if (page.pageIndex === 0) {
            this.setState({success: true, loading: false});
        }
    }

    static supports(fileInfo) {
        return fileInfo.extension === 'pdf';
    }

    render() {
        if (this.state.loading) {
            return (
                <div className='view-image__loading'>
                    <img
                        className='loader-image'
                        src={loadingGif}
                    />
                </div>
            );
        }

        if (!this.state.success) {
            return (
                <FileInfoPreview
                    fileInfo={this.props.fileInfo}
                    fileUrl={this.props.fileUrl}
                />
            );
        }

        const pdfCanvases = [];
        for (let i = 0; i < this.state.numPages; i++) {
            pdfCanvases.push(
                <canvas
                    ref={'pdfCanvas' + i}
                    key={'previewpdfcanvas' + i}
                />
            );

            if (i < this.state.numPages - 1 && this.state.numPages > 1) {
                pdfCanvases.push(
                    <div className='pdf-preview-spacer'/>
                );
            }
        }

        if (this.state.pdf.numPages > MAX_PDF_PAGES) {
            pdfCanvases.push(
                <a
                    href={this.props.fileUrl}
                    className='pdf-max-pages'
                >
                    <FormattedMessage
                        id='pdf_preview.max_pages'
                        defaultMessage='Download to read more pages'
                    />
                </a>
            );
        }

        return (
            <div className='post-code'>
                {pdfCanvases}
            </div>
        );
    }
}

PDFPreview.propTypes = {
    fileInfo: PropTypes.object.isRequired,
    fileUrl: PropTypes.string.isRequired
};
