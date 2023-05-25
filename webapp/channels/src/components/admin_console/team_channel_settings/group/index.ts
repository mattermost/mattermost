import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {getGroups} from 'mattermost-redux/actions/groups';
import {t} from 'utils/i18n';
import {Group} from '@mattermost/types/groups';
import List from './group_list';
import { GlobalState } from 'types/store';

type Actions = {
   
    getData(): Promise<Group[]>;
}
type OwnProps = {
    groups: Group[], 
    totalGroups: number, 
    isModeSync: boolean,
    onGroupRemoved: (gid: string) => void, 
    setNewGroupRole: (gid: string) => void
}

function mapStateToProps( state: GlobalState, ownProps: OwnProps) {   
    return {
        data: ownProps.groups,
        total: ownProps.totalGroups,
        emptyListTextId: ownProps.isModeSync ? t('admin.team_channel_settings.group_list.no-synced-groups') : t('admin.team_channel_settings.group_list.no-groups'),
        emptyListTextDefaultMessage: ownProps.isModeSync ? 'At least one group must be specified' : 'No groups specified yet',
        removeGroup: ownProps.onGroupRemoved,
        setNewGroupRole: ownProps.setNewGroupRole,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getData: () => getGroups(),
          
        }, dispatch),
    };
}


export default connect(mapStateToProps, mapDispatchToProps)(List);

