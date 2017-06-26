// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as GlobalActions from 'actions/global_actions.jsx';
import LocalizationStore from 'stores/localization_store.jsx';
import {Client4} from 'mattermost-redux/client';

import {IntlProvider} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';
import FastClick from 'fastclick';
import $ from 'jquery';

import {browserHistory} from 'react-router/es6';
import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import Constants from 'utils/constants.jsx';

export default class Root extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            locale: LocalizationStore.getLocale(),
            translations: LocalizationStore.getTranslations()
        };

        this.localizationChanged = this.localizationChanged.bind(this);
        this.redirectIfNecessary = this.redirectIfNecessary.bind(this);

        const segmentKey = Constants.DIAGNOSTICS_SEGMENT_KEY;

        // Ya....
        /*eslint-disable */
        if (segmentKey != null && segmentKey !== '' && window.mm_config.DiagnosticsEnabled === 'true') {
            !function(){var analytics=global.window.analytics=global.window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","group","track","ready","alias","page","once","off","on"];analytics.factory=function(t){return function(){var e=Array.prototype.slice.call(arguments);e.unshift(t);analytics.push(e);return analytics}};for(var t=0;t<analytics.methods.length;t++){var e=analytics.methods[t];analytics[e]=analytics.factory(e)}analytics.load=function(t){var e=document.createElement("script");e.type="text/javascript";e.async=!0;e.src=("https:"===document.location.protocol?"https://":"http://")+"cdn.segment.com/analytics.js/v1/"+t+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(e,n)};analytics.SNIPPET_VERSION="3.0.1";
                analytics.load(segmentKey);

                analytics.page('ApplicationLoaded', {
                        path: '',
                        referrer: '',
                        search: '',
                        title: '',
                        url: '',
                    },
                    {
                        context: {
                            ip: '0.0.0.0'
                        },
                        anonymousId: '00000000000000000000000000'
                    });
            }}();
        }
        /*eslint-enable */

        // Force logout of all tabs if one tab is logged out
        $(window).bind('storage', (e) => {
            // when one tab on a browser logs out, it sets __logout__ in localStorage to trigger other tabs to log out
            if (e.originalEvent.key === '__logout__' && e.originalEvent.storageArea === localStorage && e.originalEvent.newValue) {
                // make sure it isn't this tab that is sending the logout signal (only necessary for IE11)
                if (BrowserStore.isSignallingLogout(e.originalEvent.newValue)) {
                    return;
                }

                console.log('detected logout from a different tab'); //eslint-disable-line no-console
                GlobalActions.emitUserLoggedOutEvent('/', false);
            }

            if (e.originalEvent.key === '__login__' && e.originalEvent.storageArea === localStorage && e.originalEvent.newValue) {
                // make sure it isn't this tab that is sending the logout signal (only necessary for IE11)
                if (BrowserStore.isSignallingLogin(e.originalEvent.newValue)) {
                    return;
                }

                console.log('detected login from a different tab'); //eslint-disable-line no-console
                location.reload();
            }
        });

        // Fastclick
        FastClick.attach(document.body);
    }

    localizationChanged() {
        const locale = LocalizationStore.getLocale();

        Client4.setAcceptLanguage(locale);
        this.setState({locale, translations: LocalizationStore.getTranslations()});
    }

    redirectIfNecessary(props) {
        if (props.location.pathname === '/') {
            if (UserStore.getNoAccounts()) {
                browserHistory.push('/signup_user_complete');
            } else if (UserStore.getCurrentUser()) {
                GlobalActions.redirectUserToDefaultTeam();
            } else {
                browserHistory.push('/login' + window.location.search);
            }
        }
    }

    componentWillReceiveProps(newProps) {
        this.redirectIfNecessary(newProps);
    }

    componentWillMount() {
        // Redirect if Necessary
        this.redirectIfNecessary(this.props);
    }

    componentDidMount() {
        // Setup localization listener
        LocalizationStore.addChangeListener(this.localizationChanged);

        // Get our localizaiton
        GlobalActions.loadCurrentLocale();
    }

    componentWillUnmount() {
        LocalizationStore.removeChangeListener(this.localizationChanged);
    }

    render() {
        if (this.state.translations == null || this.props.children == null) {
            return <div/>;
        }

        return (
            <IntlProvider
                locale={this.state.locale}
                messages={this.state.translations}
                key={this.state.locale}
            >
                {this.props.children}
            </IntlProvider>
        );
    }
}

Root.defaultProps = {
};

Root.propTypes = {
    children: PropTypes.object
};
