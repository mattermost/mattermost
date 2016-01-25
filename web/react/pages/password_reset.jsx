// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PasswordReset from '../components/password_reset.jsx';
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
                <PasswordReset
                    isReset={this.props.map.IsReset}
                    teamDisplayName={this.props.map.TeamDisplayName}
                    teamName={this.props.map.TeamName}
                    hash={this.props.map.Hash}
                    data={this.props.map.Data}
                />
            </IntlProvider>
        );
    }
}

global.window.setup_password_reset_page = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('reset')
    );
};
