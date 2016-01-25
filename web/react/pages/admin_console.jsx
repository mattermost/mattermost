// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ErrorBar from '../components/error_bar.jsx';
import SelectTeamModal from '../components/admin_console/select_team_modal.jsx';
import AdminController from '../components/admin_console/admin_controller.jsx';
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
                <div>
                    <ErrorBar/>
                    <AdminController
                        tab={this.props.map.ActiveTab}
                        teamId={this.props.map.TeamId}
                    />
                    <SelectTeamModal />
                </div>
            </IntlProvider>
        );
    }
}

global.window.setup_admin_console_page = function setup(props) {
    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('admin_controller')
    );
};
