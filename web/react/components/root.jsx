// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as GlobalActions from '../action_creators/global_actions.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import LocalizationStore from '../stores/localization_store.jsx';

var IntlProvider = ReactIntl.IntlProvider;

export default class Root extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            locale: 'en',
            translations: null
        };

        this.localizationChanged = this.localizationChanged.bind(this);
    }
    localizationChanged() {
        this.setState({locale: LocalizationStore.getLocale(), translations: LocalizationStore.getTranslations()});
    }
    componentWillMount() {
        // Setup localization listener
        LocalizationStore.addChangeListener(this.localizationChanged);

        // Browser store check version
        BrowserStore.checkVersion();

        window.onerror = (msg, url, line, column, stack) => {
            var l = {};
            l.level = 'ERROR';
            l.message = 'msg: ' + msg + ' row: ' + line + ' col: ' + column + ' stack: ' + stack + ' url: ' + url;

            $.ajax({
                url: '/api/v1/admin/log_client',
                dataType: 'json',
                contentType: 'application/json',
                type: 'POST',
                data: JSON.stringify(l)
            });

            if (window.mm_config.EnableDeveloper === 'true') {
                window.ErrorStore.storeLastError({message: 'DEVELOPER MODE: A javascript error has occured.  Please use the javascript console to capture and report the error (row: ' + line + ' col: ' + column + ').'});
                window.ErrorStore.emitChange();
            }
        };

        // Ya....
        /*eslint-disable */
        if (window.mm_config.SegmentDeveloperKey != null && window.mm_config.SegmentDeveloperKey !== "") {
            !function(){var analytics=global.window.analytics=global.window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","group","track","ready","alias","page","once","off","on"];analytics.factory=function(t){return function(){var e=Array.prototype.slice.call(arguments);e.unshift(t);analytics.push(e);return analytics}};for(var t=0;t<analytics.methods.length;t++){var e=analytics.methods[t];analytics[e]=analytics.factory(e)}analytics.load=function(t){var e=document.createElement("script");e.type="text/javascript";e.async=!0;e.src=("https:"===document.location.protocol?"https://":"http://")+"cdn.segment.com/analytics.js/v1/"+t+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(e,n)};analytics.SNIPPET_VERSION="3.0.1";
            analytics.load(window.mm_config.SegmentDeveloperKey);
            analytics.page();
            }}();
        } else {
            global.window.analytics = {};
            global.window.analytics.page = function(){};
            global.window.analytics.track = function(){};
        }
        /*eslint-enable */

        // Get our localizaiton
        GlobalActions.newLocalizationSelected('en');
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
