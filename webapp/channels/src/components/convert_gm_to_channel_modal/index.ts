import {GlobalState} from "types/store";
import {Dispatch} from "redux";
import {connect} from "react-redux";
import ConvertGmToChannelModal from "components/convert_gm_to_channel_modal/convert_gm_to_channel_modal";


function mapStateToProps(state: GlobalState, props: any) {
    return {}
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: {

        }, dispatch,
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ConvertGmToChannelModal);
