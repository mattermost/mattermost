// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BrowserStore from '../../../stores/browser_store.jsx';

import {FormattedMessage} from 'mm-intl';

import {browserHistory} from 'react-router';

export default class SignupTeamComplete extends React.Component {
    constructor(props) {
        super(props);

        this.updateParent = this.updateParent.bind(this);
    }
    componentWillMount() {
        const data = JSON.parse(this.props.location.query.d);
        this.hash = this.props.location.query.h;

        var initialState = BrowserStore.getGlobalItem(this.hash);

        if (!initialState) {
            initialState = {};
            initialState.wizard = 'welcome';
            initialState.team = {};
            initialState.team.email = data.email;
            initialState.team.allowed_domains = '';
            initialState.invites = [];
            initialState.invites.push('');
            initialState.invites.push('');
            initialState.invites.push('');
            initialState.user = {};
            initialState.hash = this.hash;
            initialState.data = this.props.location.query.d;
        }

        this.setState(initialState);
    }
    componentDidMount() {
        browserHistory.push('/signup_team_complete/welcome');
    }
    updateParent(state, skipSet) {
        BrowserStore.setGlobalItem(this.hash, state);

        if (!skipSet) {
            this.setState(state);
            browserHistory.push('/signup_team_complete/' + state.wizard);
        }
    }
    render() {
        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span classNameName='fa fa-chevron-left'/>
                        <FormattedMessage id='web.header.back'/>
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <div id='signup-team-complete'>
                            {React.cloneElement(this.props.children, {
                                state: this.state,
                                updateParent: this.updateParent
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

SignupTeamComplete.defaultProps = {
};
SignupTeamComplete.propTypes = {
    location: React.PropTypes.object,
    children: React.PropTypes.node
};
