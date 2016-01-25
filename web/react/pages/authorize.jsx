// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Authorize from '../components/authorize.jsx';
import * as Client from '../utils/client.jsx';

var IntlProvider = ReactIntl.IntlProvider;

class Root extends React.Component {
    constructor() {
        super();
        this.state = {
            translations: null,
            loaded: false
        };
    }

    static propTypes() {
        return {
            map: React.PropTypes.object.isRequired
        };
    }

    componentWillMount() {
        Client.getTranslations(
            this.props.map.Locale,
            (data) => {
                this.setState({
                    translations: data,
                    loaded: true
                });
            },
            () => {
                this.setState({
                    loaded: true
                });
            }
        );
    }

    render() {
        if (!this.state.loaded) {
            return <div></div>;
        }

        return (
            <IntlProvider
                locale={this.props.map.Locale}
                messages={this.state.translations}
            >
                <Authorize
                    teamName={this.props.map.TeamName}
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

global.window.setup_authorize_page = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('authorize')
    );
};
