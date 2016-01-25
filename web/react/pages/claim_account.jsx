// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ClaimAccount from '../components/claim/claim_account.jsx';
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
                <ClaimAccount
                    email={this.props.map.Email}
                    currentType={this.props.map.CurrentType}
                    newType={this.props.map.NewType}
                    teamName={this.props.map.TeamName}
                    teamDisplayName={this.props.map.TeamDisplayName}
                />
            </IntlProvider>
        );
    }
}

global.window.setup_claim_account_page = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('claim')
    );
};