// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import ProfilePopover from './profile_popover.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {OverlayTrigger} from 'react-bootstrap';

export default class ProfilePicture extends React.Component {
    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        if (nextProps.src !== this.props.src) {
            return true;
        }

        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (nextProps.width !== this.props.width) {
            return true;
        }

        if (nextProps.height !== this.props.height) {
            return true;
        }

        if (nextProps.isBusy !== this.props.isBusy) {
            return true;
        }

        return false;
    }

    render() {
        let statusClass = '';
        if (this.props.status) {
            statusClass = 'status-' + this.props.status;
        }
        if (this.props.user) {
            return (
                <OverlayTrigger
                    trigger='click'
                    placement='right'
                    rootClose={true}
                    overlay={
                        <ProfilePopover
                            user={this.props.user}
                            src={this.props.src}
                            status={this.props.status}
                            isBusy={this.props.isBusy}
                        />
                }
                >
                    <span className={`status-wrapper ${statusClass}`}>
                        <img
                            className='more-modal__image'
                            width={this.props.width}
                            height={this.props.width}
                            src={this.props.src}
                        />
                    </span>
                </OverlayTrigger>
            );
        }
        return (
            <span className={`status-wrapper ${statusClass}`}>
                <img
                    className='more-modal__image'
                    width={this.props.width}
                    height={this.props.width}
                    src={this.props.src}
                />
            </span>
        );
    }
}

ProfilePicture.defaultProps = {
    width: '36',
    height: '36'
};
ProfilePicture.propTypes = {
    src: React.PropTypes.string.isRequired,
    status: React.PropTypes.string,
    width: React.PropTypes.string,
    height: React.PropTypes.string,
    user: React.PropTypes.object,
    isBusy: React.PropTypes.bool
};
