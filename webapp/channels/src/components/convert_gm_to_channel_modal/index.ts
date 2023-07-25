import {GlobalState} from "types/store";
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from "redux";
import {connect} from "react-redux";
import ConvertGmToChannelModal from "components/convert_gm_to_channel_modal/convert_gm_to_channel_modal";
import {makeGetChannel} from "mattermost-redux/selectors/entities/channels";
import {Action} from "mattermost-redux/types/actions";
import {closeModal} from "actions/views/modals";


function mapStateToProps(state: GlobalState, props: any) {
    return {}
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
