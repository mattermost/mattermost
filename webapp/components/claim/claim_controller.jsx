import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import logoImage from 'images/logo.png';

export default class ClaimController extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }
    componentWillMount() {
        this.setState({
            email: this.props.location.query.email,
            newType: this.props.location.query.new_type,
            oldType: this.props.location.query.old_type
        });
    }
    render() {
        return (
            <div>
                <div className='signup-header'>
                    <Link to='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </Link>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <img
                            className='signup-team-logo'
                            src={logoImage}
                        />
                        <div id='claim'>
                            {React.cloneElement(this.props.children, {
                                currentType: this.state.oldType,
                                newType: this.state.newType,
                                email: this.state.email
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ClaimController.defaultProps = {
};
ClaimController.propTypes = {
    location: PropTypes.object.isRequired,
    children: PropTypes.node
};
