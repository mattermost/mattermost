// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SignupTeam from '../components/signup_team.jsx';
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
            map: React.PropTypes.object.isRequired,
            teams: React.PropTypes.object.isRequired
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
                <SignupTeam teams={this.props.teams} />
            </IntlProvider>
        );
    }
}

global.window.setup_signup_team_page = function setup(props) {
    var teams = [];

    for (var prop in props) {
        if (props.hasOwnProperty(prop)) {
            if (prop !== 'Title' && prop !== 'Locale' && prop !== 'Info') {
                teams.push({name: prop, display_name: props[prop]});
            }
        }
    }

    ReactDOM.render(
        <Root
            map={props}
            teams={teams}
        />,
        document.getElementById('signup-team')
    );
};