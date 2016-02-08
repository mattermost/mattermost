// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';
import * as Client from '../utils/client.jsx';
import LoadingScreen from './loading_screen.jsx';

import {browserHistory} from 'react-router';

export default class DoVerifyEmail extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            verifyStatus: 'pending',
            serverError: ''
        };
    }
    componentWillMount() {
        const uid = this.props.location.query.uid;
        const hid = this.props.location.query.hid;
        const teamName = this.props.location.query.teamname;
        const email = this.props.location.query.email;

        Client.verifyEmail(
            () => {
                browserHistory.push('/' + teamName + '/login?extra=verified&email=' + email);
            },
            (err) => {
                this.setState({verifyStatus: 'failure', serverError: err.message});
            },
            uid,
            hid
        );
    }
    render() {
        if (this.state.verifyStatus !== 'failure') {
            return (<LoadingScreen/>);
        }

        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <h3>
                            <FormattedMessage
                                id='email_verify.almost'
                                defaultMessage='{siteName}: You are almost done'
                                values={{
                                    siteName: global.window.mm_config.SiteName
                                }}
                            />
                        </h3>
                        <div>
                            <p>
                                <FormattedMessage id='email_verify.verifyFailed'/>
                            </p>
                            <p className='alert alert-danger'>
                                <i className='fa fa-times'/>
                                {this.state.serverError}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

DoVerifyEmail.defaultProps = {
};
DoVerifyEmail.propTypes = {
    location: React.PropTypes.object.isRequired
};
