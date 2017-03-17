/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import {Component, PropTypes, createElement} from 'react';
import {intlShape, messageDescriptorPropTypes} from '../types';
import {
    invariantIntlContext,
    shallowEquals,
    shouldIntlComponentUpdate,
} from '../utils';

export default class FormattedHTMLMessage extends Component {
    constructor(props, context) {
        super(props, context);
        invariantIntlContext(context);
    }

    shouldComponentUpdate(nextProps, ...next) {
        const {values}             = this.props;
        const {values: nextValues} = nextProps;

        if (!shallowEquals(nextValues, values)) {
            return true;
        }

        // Since `values` has already been checked, we know they're not
        // different, so the current `values` are carried over so the shallow
        // equals comparison on the other props isn't affected by the `values`.
        let nextPropsToCheck = {
            ...nextProps,
            values,
        };

        return shouldIntlComponentUpdate(this, nextPropsToCheck, ...next);
    }

    render() {
        const {formatHTMLMessage} = this.context.intl;

        const {
            id,
            description,
            defaultMessage,
            values: rawValues,
            tagName,
            children,
        } = this.props;

        let descriptor           = {id, description, defaultMessage};
        let formattedHTMLMessage = formatHTMLMessage(descriptor, rawValues);

        if (typeof children === 'function') {
            return children(formattedHTMLMessage);
        }

        // Since the message presumably has HTML in it, we need to set
        // `innerHTML` in order for it to be rendered and not escaped by React.
        // To be safe, all string prop values were escaped when formatting the
        // message. It is assumed that the message is not UGC, and came from the
        // developer making it more like a template.
        //
        // Note: There's a perf impact of using this component since there's no
        // way for React to do its virtual DOM diffing.
        return createElement(tagName, {
            dangerouslySetInnerHTML: {
                __html: formattedHTMLMessage,
            },
        });
    }
}

FormattedHTMLMessage.displayName = 'FormattedHTMLMessage';

FormattedHTMLMessage.contextTypes = {
    intl: intlShape,
};

FormattedHTMLMessage.propTypes = {
    ...messageDescriptorPropTypes,
    values  : PropTypes.object,
    tagName : PropTypes.string,
    children: PropTypes.func,
};

FormattedHTMLMessage.defaultProps = {
    values : {},
    tagName: 'span',
};
