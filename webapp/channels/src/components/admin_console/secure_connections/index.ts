// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// import type {ConnectedProps} from 'react-redux';
// import {connect} from 'react-redux';

// import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
// import {getConfig} from 'mattermost-redux/selectors/entities/general';

// import type {GlobalState} from 'types/store';

import SecureConnections from './secure_connections';

export {searchableStrings} from './secure_connections';
export {default as SecureConnectionDetail} from './secure_connection_detail';

// function mapStateToProps(state: GlobalState) {
//     const config = getConfig(state);
//     const currentUser = getCurrentUser(state);

//     return {
//         currentUser,
//     };
// }

// const mapDispatchToProps = {

// };

// const connector = connect(mapStateToProps, mapDispatchToProps);

// export type PropsFromRedux = ConnectedProps<typeof connector>;

// export default connect(mapStateToProps, mapDispatchToProps)(ConnectedOrganizations);
export default SecureConnections;
