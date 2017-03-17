/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import {Component, Children, PropTypes} from 'react';
import IntlMessageFormat from 'intl-messageformat';
import IntlRelativeFormat from 'intl-relativeformat';
import IntlPluralFormat from '../plural';
import memoizeIntlConstructor from 'intl-format-cache';
import invariant from 'invariant';
import {shouldIntlComponentUpdate, filterProps} from '../utils';
import {intlConfigPropTypes, intlFormatPropTypes, intlShape} from '../types';
import * as format from '../format';
import {hasLocaleData} from '../locale-data-registry';

const intlConfigPropNames = Object.keys(intlConfigPropTypes);
const intlFormatPropNames = Object.keys(intlFormatPropTypes);

// These are not a static property on the `IntlProvider` class so the intl
// config values can be inherited from an <IntlProvider> ancestor.
const defaultProps = {
    formats : {},
    messages: {},

    defaultLocale : 'en',
    defaultFormats: {},
};

export default class IntlProvider extends Component {
    constructor(props, context) {
        super(props, context);

        invariant(typeof Intl !== 'undefined',
            '[React Intl] The `Intl` APIs must be available in the runtime, ' +
            'and do not appear to be built-in. An `Intl` polyfill should be loaded.\n' +
            'See: http://formatjs.io/guides/runtime-environments/'
        );

        const {intl: intlContext} = context;

        // Used to stabilize time when performing an initial rendering so that
        // all relative times use the same reference "now" time.
        let initialNow;
        if (isFinite(props.initialNow)) {
            initialNow = Number(props.initialNow);
        } else {
            // When an `initialNow` isn't provided via `props`, look to see an
            // <IntlProvider> exists in the ancestry and call its `now()`
            // function to propagate its value for "now".
            initialNow = intlContext ? intlContext.now() : Date.now();
        }

        // Creating `Intl*` formatters is expensive. If there's a parent
        // `<IntlProvider>`, then its formatters will be used. Otherwise, this
        // memoize the `Intl*` constructors and cache them for the lifecycle of
        // this IntlProvider instance.
        const {formatters = {
            getDateTimeFormat: memoizeIntlConstructor(Intl.DateTimeFormat),
            getNumberFormat  : memoizeIntlConstructor(Intl.NumberFormat),
            getMessageFormat : memoizeIntlConstructor(IntlMessageFormat),
            getRelativeFormat: memoizeIntlConstructor(IntlRelativeFormat),
            getPluralFormat  : memoizeIntlConstructor(IntlPluralFormat),
        }} = (intlContext || {});

        this.state = {
            ...formatters,

            // Wrapper to provide stable "now" time for initial render.
            now: () => {
                return this._didDisplay ? Date.now() : initialNow;
            },
        };
    }

    getConfig() {
        const {intl: intlContext} = this.context;

        // Build a whitelisted config object from `props`, defaults, and
        // `context.intl`, if an <IntlProvider> exists in the ancestry.
        let config = filterProps(this.props, intlConfigPropNames, intlContext);

        // Apply default props. This must be applied last after the props have
        // been resolved and inherited from any <IntlProvider> in the ancestry.
        // This matches how React resolves `defaultProps`.
        for (let propName in defaultProps) {
            if (config[propName] === undefined) {
                config[propName] = defaultProps[propName];
            }
        }

        if (!hasLocaleData(config.locale)) {
            const {
                locale,
                defaultLocale,
                defaultFormats,
            } = config;

            if (process.env.NODE_ENV !== 'production') {
                console.error(
                    `[React Intl] Missing locale data for locale: "${locale}". ` +
                    `Using default locale: "${defaultLocale}" as fallback.`
                );
            }

            // Since there's no registered locale data for `locale`, this will
            // fallback to the `defaultLocale` to make sure things can render.
            // The `messages` are overridden to the `defaultProps` empty object
            // to maintain referential equality across re-renders. It's assumed
            // each <FormattedMessage> contains a `defaultMessage` prop.
            config = {
                ...config,
                locale  : defaultLocale,
                formats : defaultFormats,
                messages: defaultProps.messages,
            };
        }

        return config;
    }

    getBoundFormatFns(config, state) {
        return intlFormatPropNames.reduce((boundFormatFns, name) => {
            boundFormatFns[name] = format[name].bind(null, config, state);
            return boundFormatFns;
        }, {});
    }

    getChildContext() {
        const config = this.getConfig();

        // Bind intl factories and current config to the format functions.
        const boundFormatFns = this.getBoundFormatFns(config, this.state);

        const {now, ...formatters} = this.state;

        return {
            intl: {
                ...config,
                ...boundFormatFns,
                formatters,
                now,
            },
        };
    }

    shouldComponentUpdate(...next) {
        return shouldIntlComponentUpdate(this, ...next);
    }

    componentDidMount() {
        this._didDisplay = true;
    }

    render() {
        return Children.only(this.props.children);
    }
}

IntlProvider.displayName = 'IntlProvider';

IntlProvider.contextTypes = {
    intl: intlShape,
};

IntlProvider.childContextTypes = {
    intl: intlShape.isRequired,
};

IntlProvider.propTypes = {
    ...intlConfigPropTypes,
    children  : PropTypes.element.isRequired,
    initialNow: PropTypes.any,
};
