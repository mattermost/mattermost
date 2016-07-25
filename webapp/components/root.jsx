// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as GlobalActions from 'actions/global_actions.jsx';
import LocalizationStore from 'stores/localization_store.jsx';
import Client from 'client/web_client.jsx';

import {IntlProvider} from 'react-intl';

import React from 'react';

import FastClick from 'fastclick';

import {browserHistory} from 'react-router/es6';
import UserStore from 'stores/user_store.jsx';

export default class Root extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            locale: 'en',
            translations: null
        };

        this.localizationChanged = this.localizationChanged.bind(this);
        this.redirectIfNecessary = this.redirectIfNecessary.bind(this);

        // Ya....
        /*eslint-disable */
        if (window.mm_config.SegmentDeveloperKey != null && window.mm_config.SegmentDeveloperKey !== "") {
            !function(){var analytics=global.window.analytics=global.window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","group","track","ready","alias","page","once","off","on"];analytics.factory=function(t){return function(){var e=Array.prototype.slice.call(arguments);e.unshift(t);analytics.push(e);return analytics}};for(var t=0;t<analytics.methods.length;t++){var e=analytics.methods[t];analytics[e]=analytics.factory(e)}analytics.load=function(t){var e=document.createElement("script");e.type="text/javascript";e.async=!0;e.src=("https:"===document.location.protocol?"https://":"http://")+"cdn.segment.com/analytics.js/v1/"+t+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(e,n)};analytics.SNIPPET_VERSION="3.0.1";
                analytics.load(window.mm_config.SegmentDeveloperKey);
                analytics.page();
            }}();
        }
        /*eslint-enable */

        // Fastclick
        FastClick.attach(document.body);
    }
    localizationChanged() {
        const locale = LocalizationStore.getLocale();

        Client.setAcceptLanguage(locale);
        this.setState({locale, translations: LocalizationStore.getTranslations()});
    }

    redirectIfNecessary(props) {
        if (props.location.pathname === '/') {
            if (UserStore.getNoAccounts()) {
                browserHistory.push('/signup_user_complete');
            } else if (UserStore.getCurrentUser()) {
                browserHistory.push('/select_team');
            } else {
                browserHistory.push('/login');
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
        GlobalActions.loadDefaultLocale();
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
    children: React.PropTypes.object
};
