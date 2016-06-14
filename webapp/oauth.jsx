// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

import Authorize from 'components/authorize.jsx';

import Client from 'utils/web_client.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import LocalizationStore from 'stores/localization_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as I18n from 'i18n/i18n.jsx';

import {IntlProvider} from 'react-intl';

import 'bootstrap-colorpicker/dist/css/bootstrap-colorpicker.css';
import 'google-fonts/google-fonts.css';
import 'sass/styles.scss';

class Root extends React.Component {
    static propTypes() {
        return {
            map: React.PropTypes.object.isRequired
        };
    }
    constructor(props) {
        super(props);
        this.state = {
            locale: 'en',
            translations: null
        };

        this.localizationChanged = this.localizationChanged.bind(this);
    }
    localizationChanged() {
        const locale = LocalizationStore.getLocale();

        Client.setAcceptLanguage(locale);
        this.setState({locale, translations: LocalizationStore.getTranslations()});
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
        if (this.state.translations == null) {
            return <div/>;
        }

        return (
            <IntlProvider
                locale={this.state.locale}
                messages={this.state.translations}
                key={this.state.locale}
            >
                <Authorize
                    appName={this.props.map.AppName}
                    responseType={this.props.map.ResponseType}
                    clientId={this.props.map.ClientId}
                    redirectUri={this.props.map.RedirectUri}
                    scope={this.props.map.Scope}
                    state={this.props.map.State}
                />
            </IntlProvider>
        );
    }
}

function preRenderSetup(callwhendone) {
    var d1 = $.Deferred(); //eslint-disable-line new-cap

    GlobalActions.emitInitialLoad(
        () => {
            d1.resolve();
        }
    );

    // Make sure the websockets close and reset version
    $(window).on('beforeunload',
        () => {
            BrowserStore.setLastServerVersion('');
        }
    );

    function afterIntl() {
        $.when(d1).done(() => {
            I18n.doAddLocaleData();
            callwhendone();
        });
    }

    if (global.Intl) {
        afterIntl();
    } else {
        I18n.safariFix(afterIntl);
    }
}

function renderRootComponent() {
    ReactDOM.render(
        <Root map={this}/>,
        document.getElementById('authorize'));
}

global.window.setup_authorize_page = (props) => {
    // Do the pre-render setup and call renderRootComponent when done
    preRenderSetup(renderRootComponent.bind(props));
};
