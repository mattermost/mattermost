import {GlobalState} from "types/store";
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from "redux";
import {connect} from "react-redux";
import ConvertGmToChannelModal, { Props } from "components/convert_gm_to_channel_modal/convert_gm_to_channel_modal";
import {Action} from "mattermost-redux/types/actions";
import {closeModal} from "actions/views/modals";
import {
    getCurrentUserId,
    makeGetProfilesInChannel
} from "mattermost-redux/selectors/entities/users";
import {getTeammateNameDisplaySetting} from "mattermost-redux/selectors/entities/preferences";

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const allProfilesInChannel = makeGetProfilesInChannel()(state, ownProps.channel.id);
    const currentUserId = getCurrentUserId(state);
    const validProfilesInChannel = allProfilesInChannel.filter(
        (user) => user.id !== currentUserId && user.delete_at === 0,
    );

    const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state)

    return {
        profilesInChannel: validProfilesInChannel,
        teammateNameDisplaySetting: teammateNameDisplaySetting,
    }
}

export type Actions = {
    closeModal: (modalID: string) => void,
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            closeModal,
        }, dispatch)
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ConvertGmToChannelModal);
