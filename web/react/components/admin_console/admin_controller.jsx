// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AdminSidebar = require('./admin_sidebar.jsx');
var EmailTab = require('./email_settings.jsx');
var JobsTab = require('./jobs_settings.jsx');
var LogsTab = require('./logs.jsx');
var Navbar = require('../../components/navbar.jsx');

export default class AdminController extends React.Component {
    constructor(props) {
        super(props);

        this.selectTab = this.selectTab.bind(this);

        this.state = {
            selected: 'email_settings'
        };
    }

    selectTab(tab) {
        this.setState({selected: tab});
    }

    render() {
        var tab = '';

        if (this.state.selected === 'email_settings') {
            tab = <EmailTab />;
        } else if (this.state.selected === 'job_settings') {
            tab = <JobsTab />;
        } else if (this.state.selected === 'logs') {
            tab = <LogsTab />;
        }

        return (
            <div className='container-fluid'>
                <div
                    className='sidebar--menu'
                    id='sidebar-menu'
                />
                <AdminSidebar
                    selected={this.state.selected}
                    selectTab={this.selectTab}
                />
                <div className='inner__wrap channel__wrap'>
                    <div className='row header'>
                        <Navbar teamDisplayName='Admin Console' />
                    </div>
                    <div className='row main'>
                        <div
                            id='app-content'
                            className='app__content admin'
                        >
                        {tab}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}