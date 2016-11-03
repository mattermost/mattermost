// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import $ from 'jquery';

export default class AutosizeTextarea extends React.Component {
    static propTypes = {
        value: React.PropTypes.string,
        placeholder: React.PropTypes.string
    }

    constructor(props) {
        super(props);

        this.height = 0;
    }

    get value() {
        return this.refs.textarea.value;
    }

    set value(value) {
        this.refs.textarea.value = value;
    }

    componentDidUpdate() {
        const height = this.refs.reference.scrollHeight;

        if (height > 0 && height !== this.height) {
            const textarea = this.refs.textarea;

            const borderWidth = parseInt($(textarea).css('border-top-width'), 10) + parseInt($(textarea).css('border-bottom-width'), 10);

            // Directly change the height to avoid circular rerenders
            textarea.style.height = String(height + borderWidth) + 'px';

            this.height = height;
        }
    }

    focus() {
        this.refs.textarea.focus();
    }

    getDOMNode() {
        return this.refs.textarea;
    }

    render() {
        window.forceUpdate = this.forceUpdate.bind(this);
        const {
            value,
            placeholder,
            ...otherProps
        } = this.props;

        const heightProps = {};
        if (this.height <= 0) {
            // Set an initial number of rows so that the textarea doesn't appear too large when its first rendered
            heightProps.rows = 1;
        } else {
            heightProps.height = this.height;
        }

        return (
            <div>
                <textarea
                    ref='textarea'
                    {...heightProps}
                    {...this.props}
                />
                <div style={{height: 0, overflow: 'hidden'}}>
                    <textarea
                        ref='reference'
                        style={{height: 'auto', width: '100%'}}
                        value={value || placeholder}
                        rows='1'
                        {...otherProps}
                    />
                </div>
            </div>
        );
    }
}