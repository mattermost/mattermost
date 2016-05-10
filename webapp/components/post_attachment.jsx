// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as TextFormatting from 'utils/text_formatting.jsx';

import {intlShape, injectIntl, defineMessages} from 'react-intl';

const holders = defineMessages({
    collapse: {
        id: 'post_attachment.collapse',
        defaultMessage: '▲ collapse text'
    },
    more: {
        id: 'post_attachment.more',
        defaultMessage: '▼ read more'
    }
});

import React from 'react';

class PostAttachment extends React.Component {
    constructor(props) {
        super(props);

        this.getFieldsTable = this.getFieldsTable.bind(this);
        this.getInitState = this.getInitState.bind(this);
        this.shouldCollapse = this.shouldCollapse.bind(this);
        this.toggleCollapseState = this.toggleCollapseState.bind(this);
    }

    componentDidMount() {
        $(this.refs.attachment).on('click', '.attachment-link-more', this.toggleCollapseState);
    }

    componentWillUnmount() {
        $(this.refs.attachment).off('click', '.attachment-link-more', this.toggleCollapseState);
    }

    componentWillMount() {
        this.setState(this.getInitState());
    }

    getInitState() {
        const shouldCollapse = this.shouldCollapse();
        const text = TextFormatting.formatText(this.props.attachment.text || '');
        const uncollapsedText = text + (shouldCollapse ? `<a class="attachment-link-more" href="#">${this.props.intl.formatMessage(holders.collapse)}</a>` : '');
        const collapsedText = shouldCollapse ? this.getCollapsedText() : text;

        return {
            shouldCollapse,
            collapsedText,
            uncollapsedText,
            text: shouldCollapse ? collapsedText : uncollapsedText,
            collapsed: shouldCollapse
        };
    }

    toggleCollapseState(e) {
        e.preventDefault();

        const state = this.state;
        state.text = state.collapsed ? state.uncollapsedText : state.collapsedText;
        state.collapsed = !state.collapsed;
        this.setState(state);
    }

    shouldCollapse() {
        const text = this.props.attachment.text || '';
        return (text.match(/\n/g) || []).length >= 5 || text.length > 700;
    }

    getCollapsedText() {
        let text = this.props.attachment.text || '';
        if ((text.match(/\n/g) || []).length >= 5) {
            text = text.split('\n').splice(0, 5).join('\n');
        } else if (text.length > 700) {
            text = text.substr(0, 700);
        }

        return TextFormatting.formatText(text) + `<a class="attachment-link-more" href="#">${this.props.intl.formatMessage(holders.more)}</a>`;
    }

    getFieldsTable() {
        const fields = this.props.attachment.fields;
        if (!fields || !fields.length) {
            return '';
        }

        let fieldTables = [];

        let headerCols = [];
        let bodyCols = [];
        let rowPos = 0;
        let lastWasLong = false;
        let nrTables = 0;

        fields.forEach((field, i) => {
            if (rowPos === 2 || !(field.short === true) || lastWasLong) {
                fieldTables.push(
                    <table
                        className='attachment___fields'
                        key={'attachment__table__' + nrTables}
                    >
                        <thead>
                            <tr>
                            {headerCols}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {bodyCols}
                            </tr>
                        </tbody>
                    </table>
                );
                headerCols = [];
                bodyCols = [];
                rowPos = 0;
                nrTables += 1;
                lastWasLong = false;
            }
            headerCols.push(
                <th
                    className='attachment___field-caption'
                    key={'attachment__field-caption-' + i + '__' + nrTables}
                    width='50%'
                >
                    {field.title}
                </th>
            );
            bodyCols.push(
                <td
                    className='attachment___field'
                    key={'attachment__field-' + i + '__' + nrTables}
                    dangerouslySetInnerHTML={{__html: TextFormatting.formatText(field.value || '')}}
                >
                </td>
            );
            rowPos += 1;
            lastWasLong = !(field.short === true);
        });
        if (headerCols.length > 0) { // Flush last fields
            fieldTables.push(
                <table
                    className='attachment___fields'
                    key={'attachment__table__' + nrTables}
                >
                    <thead>
                        <tr>
                            {headerCols}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {bodyCols}
                        </tr>
                    </tbody>
                </table>
            );
        }
        return (
            <div>
                {fieldTables}
            </div>
        );
    }

    render() {
        const data = this.props.attachment;

        let preText;
        if (data.pretext) {
            preText = (
                <div
                    className='attachment__thumb-pretext'
                    dangerouslySetInnerHTML={{__html: TextFormatting.formatText(data.pretext)}}
                >
                </div>
            );
        }

        let author = [];
        if (data.author_name || data.author_icon) {
            if (data.author_icon) {
                author.push(
                    <img
                        className='attachment__author-icon'
                        src={data.author_icon}
                        key={'attachment__author-icon'}
                        height='14'
                        width='14'
                    />
                );
            }
            if (data.author_name) {
                author.push(
                    <span
                        className='attachment__author-name'
                        key={'attachment__author-name'}
                    >
                        {data.author_name}
                    </span>
                );
            }
        }
        if (data.author_link) {
            author = (
                <a
                    href={data.author_link}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {author}
                </a>
            );
        }

        let title;
        if (data.title) {
            if (data.title_link) {
                title = (
                    <h1
                        className='attachment__title'
                    >
                        <a
                            className='attachment__title-link'
                            href={data.title_link}
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            {data.title}
                        </a>
                    </h1>
                );
            } else {
                title = (
                    <h1
                        className='attachment__title'
                    >
                        {data.title}
                    </h1>
                );
            }
        }

        let text;
        if (data.text) {
            text = (
                <div
                    className='attachment__text'
                    dangerouslySetInnerHTML={{__html: this.state.text}}
                >
                </div>
            );
        }

        let image;
        if (data.image_url) {
            image = (
                <img
                    className='attachment__image'
                    src={data.image_url}
                />
            );
        }

        let thumb;
        if (data.thumb_url) {
            thumb = (
                <div
                    className='attachment__thumb-container'
                >
                    <img
                        src={data.thumb_url}
                    />
                </div>
            );
        }

        const fields = this.getFieldsTable();

        let useBorderStyle;
        if (data.color && data.color[0] === '#') {
            useBorderStyle = {borderLeftColor: data.color};
        }

        return (
            <div
                className='attachment'
                ref='attachment'
            >
                {preText}
                <div className='attachment__content'>
                    <div
                        className={useBorderStyle ? 'clearfix attachment__container' : 'clearfix attachment__container attachment__container--' + data.color}
                        style={useBorderStyle}
                    >
                        {author}
                        {title}
                        <div>
                            <div
                                className={thumb ? 'attachment__body' : 'attachment__body attachment__body--no_thumb'}
                            >
                                {text}
                                {image}
                                {fields}
                            </div>
                            {thumb}
                            <div style={{clear: 'both'}}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

PostAttachment.propTypes = {
    intl: intlShape.isRequired,
    attachment: React.PropTypes.object.isRequired
};

export default injectIntl(PostAttachment);
