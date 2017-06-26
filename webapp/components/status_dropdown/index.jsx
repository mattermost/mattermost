import {setStatus} from 'mattermost-redux/actions/users';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {
    getCurrentUser,
    getStatusForUserId
} from 'mattermost-redux/selectors/entities/users';
import {Client4} from 'mattermost-redux/client';

import StatusDropdown from 'components/status_dropdown/status_dropdown.jsx';

function mapStateToProps(state) {
    const currentUser = getCurrentUser(state);
    const userId = currentUser.id;
    const lastPicUpdate = currentUser.last_picture_update;
    const profilePicture = Client4.getProfilePictureUrl(userId, lastPicUpdate);
    const status = getStatusForUserId(state, currentUser.id);
    return {
        userId,
        profilePicture,
        status
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            setStatus
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(StatusDropdown);
