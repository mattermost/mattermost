// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmailVerify from '../components/email_verify.jsx';
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
                <EmailVerify
                    isVerified={this.props.map.IsVerified}
                    teamURL={this.props.map.TeamURL}
                    userEmail={this.props.map.UserEmail}
                    resendSuccess={this.props.map.ResendSuccess}
                />
            </IntlProvider>
        );
    }
}

global.window.setupVerifyPage = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('verify')
    );
};
