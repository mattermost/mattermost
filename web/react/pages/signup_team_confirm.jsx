/**
 * Created by enahum on 1/29/16.
 */
// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SignupTeamConfirm from '../components/signup_team_confirm.jsx';
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
                <SignupTeamConfirm
                    email={this.props.map.Email}
                />
            </IntlProvider>
        );
    }
}

global.window.setup_signup_team_confirm_page = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('signup-team-confirm')
    );
};