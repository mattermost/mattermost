// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ProfilePopover from './profile_popover.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';

import {OverlayTrigger} from 'react-bootstrap';

import React from 'react';

export default class UserProfile extends React.Component {
    constructor(props) {
        super(props);

        this.hideProfilePopover = this.hideProfilePopover.bind(this);
    }
    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        if (nextProps.overwriteName !== this.props.overwriteName) {
            return true;
        }

        if (nextProps.overwriteImage !== this.props.overwriteImage) {
            return true;
        }

        if (nextProps.disablePopover !== this.props.disablePopover) {
            return true;
        }

        if (nextProps.displayNameType !== this.props.displayNameType) {
            return true;
        }

        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (nextProps.isBusy !== this.props.isBusy) {
            return true;
        }

        return false;
    }

    hideProfilePopover() {
        this.refs.overlay.hide();
    }

    render() {
        let name = '...';
        let profileImg = '';
        if (this.props.user) {
            name = Utils.displayUsername(this.props.user.id);
            profileImg = Client.getUsersRoute() + '/' + this.props.user.id + '/image?time=' + this.props.user.last_picture_update;
        }

        if (this.props.overwriteName) {
            name = this.props.overwriteName;
        }

        if (this.props.disablePopover) {
            return <div className='user-popover'>{name}</div>;
        }

        return (
            <OverlayTrigger
                ref='overlay'
                trigger='click'
                placement='right'
                rootClose={true}
                overlay={
                    <ProfilePopover
                        user={this.props.user}
                        src={profileImg}
                        status={this.props.status}
                        isBusy={this.props.isBusy}
                        hide={this.hideProfilePopover}
                    />
                }
            >
                <div
                    className='user-popover'
                    id={'profile_' + this.uniqueId}
                >
                    {name}
                </div>
            </OverlayTrigger>
        );
    }
}

UserProfile.defaultProps = {
    user: {},
    overwriteName: '',
    overwriteImage: '',
    disablePopover: false
};
UserProfile.propTypes = {
    user: React.PropTypes.object,
    overwriteName: React.PropTypes.node,
    overwriteImage: React.PropTypes.string,
    disablePopover: React.PropTypes.bool,
    displayNameType: React.PropTypes.string,
    status: React.PropTypes.string,
    isBusy: React.PropTypes.bool
};
