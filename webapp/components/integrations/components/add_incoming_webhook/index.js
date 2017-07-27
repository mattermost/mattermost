// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

 import {connect} from 'react-redux';
 import {bindActionCreators} from 'redux';
 import {createIncomingHook} from 'mattermost-redux/actions/integrations';

 import AddIncomingWebhook from './add_incoming_webhook.jsx';

 function mapStateToProps(state, ownProps) {
     return {
         ...ownProps,
         createIncomingHookRequest: state.requests.integrations.createIncomingHook
     };
 }

 function mapDispatchToProps(dispatch) {
     return {
         actions: bindActionCreators({
             createIncomingHook
         }, dispatch)
     };
 }

 export default connect(mapStateToProps, mapDispatchToProps)(AddIncomingWebhook);