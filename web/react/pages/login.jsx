// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import Login from '../components/login.jsx';

var IntlProvider = ReactIntl.IntlProvider;
ReactIntl.addLocaleData(ReactIntlLocaleData.en);
ReactIntl.addLocaleData(ReactIntlLocaleData.es);

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
                <Login
                    teamDisplayName={this.props.map.TeamDisplayName}
                    teamName={this.props.map.TeamName}
                    inviteId={this.props.map.InviteId}
                />
            </IntlProvider>
        );
    }
}

global.window.setup_login_page = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('login')
    );
};