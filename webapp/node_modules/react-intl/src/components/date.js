/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import React, {Component, PropTypes} from 'react';
import {intlShape, dateTimeFormatPropTypes} from '../types';
import {invariantIntlContext, shouldIntlComponentUpdate} from '../utils';

export default class FormattedDate extends Component {
    constructor(props, context) {
        super(props, context);
        invariantIntlContext(context);
    }

    shouldComponentUpdate(...next) {
        return shouldIntlComponentUpdate(this, ...next);
    }

    render() {
        const {formatDate}      = this.context.intl;
        const {value, children} = this.props;

        let formattedDate = formatDate(value, this.props);

        if (typeof children === 'function') {
            return children(formattedDate);
        }

        return <span>{formattedDate}</span>;
    }
}

FormattedDate.displayName = 'FormattedDate';

FormattedDate.contextTypes = {
    intl: intlShape,
};

FormattedDate.propTypes = {
    ...dateTimeFormatPropTypes,
    value   : PropTypes.any.isRequired,
    format  : PropTypes.string,
    children: PropTypes.func,
};
