import React from 'react';
import { FormattedMessage } from 'react-intl';

import { AccessControlPolicy, AccessControlPolicyRule } from '@mattermost/types/admin';

import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';
import BooleanSetting from 'components/admin_console/boolean_setting';
import ChannelSelectorModal from 'components/channel_selector_modal';
import ChannelList from 'components/admin_console/access_control/channel_list';

import BlockableLink from 'components/admin_console/blockable_link';
import SaveButton from 'components/save_button';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';

import CELEditor from 'components/admin_console/access_control/cel_editor/editor';
import TableEditor from 'components/admin_console/access_control/table_editor/table_editor';
import {getHistory} from 'utils/browser_history';

import './policy.scss';
import { ActionResult } from 'mattermost-redux/types/actions';
import { ChannelWithTeamData } from '@mattermost/types/channels';

type Props = {
    policyId?: string;
    policy?: AccessControlPolicy | null;
    actions: {
        fetchPolicy: (id: string) => Promise<ActionResult>;
        createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
        deletePolicy: (id: string) => Promise<ActionResult>;
        getChannelsForParentPolicy: (id: string, page: number, perPage: number) => Promise<ActionResult>;
        setNavigationBlocked: (blocked: boolean) => void;
        assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
        unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    };
};

type State = {
    autoSyncMembership: boolean | undefined;
    policyName: string | undefined;
    channels: string[];
    expression: string;
    serverError: boolean;
    addChannelOpen: boolean;
    editorMode: 'cel' | 'table';
    removedChannels: Record<string, ChannelWithTeamData>;
    newChannels: Record<string, ChannelWithTeamData>;
    removedChannelsCount: number;
    saveNeeded: boolean;
}

const userAttributes = [
    {
        attribute: 'Program',
        values: ['Dragon Spacecraft', 'Black Phoenix', 'Operation Deep Dive'],
    },
    {
        attribute: 'Department',
        values: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Legal', 'Customer Success', 'Support', 'Product', 'Design', 'Research', 'Security', 'Compliance', 'IT', 'Administration', 'Executive'],
    },
    {
        attribute: 'Clearance',
        values: ['Top Secret', 'Secret', 'Confidential'],
    }
];

export default class PolicyDetails extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            policyName: '',
            expression: '',
            channels: [],
            autoSyncMembership: false,
            serverError: false,
            addChannelOpen: false,
            editorMode: 'cel',
            removedChannels: {},
            newChannels: {},
            removedChannelsCount: 0,
            saveNeeded: false,
        };
    }

    componentDidMount = async () => {
        this.loadPage();
    };

    private loadPage = async () => {
        if (this.props.policyId) {
            await this.props.actions.fetchPolicy(this.props.policyId);
            // Load initial set of channels for the policy
            await this.props.actions.getChannelsForParentPolicy(this.props.policyId, 0, 15); // Using default page size
            this.setState({
                policyName: this.props.policy?.name || '',
                expression: this.props.policy?.rules?.[0]?.expression || '',
            });
        }
    };

    openAddChannel = () => {
        this.setState({addChannelOpen: true});
    };

    closeAddChannel = () => {
        this.setState({addChannelOpen: false});
    };

    handleSubmit = async () => {
        try {
            const updatedPolicy = await this.props.actions.createPolicy({
                id: this.props.policyId || '',
                name: this.state.policyName || '',
                rules: [{expression: this.state.expression, actions: []}] as AccessControlPolicyRule[],
                type: 'parent',
                version: "v0.1",
            });

            getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy/' + updatedPolicy.data.id);
           
            if (this.props.policyId) {
                if (this.state.removedChannelsCount > 0) {
                    await this.props.actions.unassignChannelsFromAccessControlPolicy(this.props.policyId, Object.keys(this.state.removedChannels));
                }
                if (Object.keys(this.state.newChannels).length > 0) {
                    await this.props.actions.assignChannelsToAccessControlPolicy(this.props.policyId, Object.keys(this.state.newChannels));
                }
            }

            this.setState({removedChannels: {}, newChannels: {}});
            await this.loadPage();
            
            this.setState({saveNeeded: false});
            this.props.actions.setNavigationBlocked(false);
        } catch (error) {
            this.setState({serverError: true});
        }
    };

    handleDelete = async () => {
        try {
            if (this.props.policyId) {
                const result = await this.props.actions.deletePolicy(this.props.policyId);
                if (result.data) {
                    getHistory().push('/admin_console/user_management/attribute_based_access_control');
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    addToNewChannels = (channels: ChannelWithTeamData[]) => {
        let {removedChannelsCount} = this.state;
        const {newChannels, removedChannels} = this.state;
        channels.forEach((channel: ChannelWithTeamData) => {
            if (removedChannels[channel.id]?.id === channel.id) {
                delete removedChannels[channel.id];
                removedChannelsCount -= 1;
            } else {
                newChannels[channel.id] = channel;
            }
        });
        this.setState({newChannels: {...newChannels}, removedChannels: {...removedChannels}, removedChannelsCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    addToRemovedChannels = (channel: ChannelWithTeamData) => {
        let {removedChannelsCount} = this.state;
        const {newChannels, removedChannels} = this.state;
        if (newChannels[channel.id]?.id === channel.id) {
            delete newChannels[channel.id];
        } else if (removedChannels[channel.id]?.id !== channel.id) {
            removedChannelsCount += 1;
            removedChannels[channel.id] = channel;
        }
        this.setState({removedChannels: {...removedChannels}, newChannels: {...newChannels}, removedChannelsCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    undoRemovedChannels = (channel: ChannelWithTeamData) => {
        let {removedChannelsCount} = this.state;
        const {newChannels, removedChannels} = this.state;
        if (removedChannels[channel.id]?.id === channel.id) {
            delete removedChannels[channel.id];
            removedChannelsCount -= 1;
        }
        this.setState({removedChannels: {...removedChannels}, newChannels: {...newChannels}, removedChannelsCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    handleExpressionChange = (value: string) => {
        this.setState({expression: value});
    };

    render() {
        const {serverError} = this.state;

        return (
            <div className='wrapper--fixed AccessControlPolicySettings'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/attribute_based_access_control'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.access_control.policy.editPolicyTitle'
                            defaultMessage='Edit Access Control Policy'
                        />
                    </div>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='admin-console__setting-group'>
                            <TextSetting
                                id='policyName'
                                label='Access control policy name:'
                                value={this.state.policyName || ''}
                                onChange={(id, value) => this.setState({policyName: value})}
                                labelClassName='col-sm-4'
                                inputClassName='col-sm-8'
                            />
                            <BooleanSetting
                                id='autoSyncMembership'
                                label='Auto-sync membership based on access rules:'
                                value={this.state.autoSyncMembership || false}
                                onChange={(value) => this.setState({autoSyncMembership: value ? true : false})}
                                setByEnv={false}
                                helpText='All users matching the property values configured below will be added as members, and membership will be automatically maintained as user property values change.'
                            />
                        </div>
                        <Card
                            expanded={true}
                            className={'console'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={'Attribute based access rules'}
                                    subtitle={'Select user attributes and values as rules to restrict channel membership.'}
                                />
                            </Card.Header>
                            <Card.Body>
                                <div className="editor-tabs">
                                    <button
                                        className={`editor-tab ${this.state.editorMode === 'table' ? 'active' : ''}`}
                                        onClick={() => this.setState({editorMode: 'table'})}
                                    >
                                        <FormattedMessage
                                            id="admin.access_control.editor.table"
                                            defaultMessage="Simple Expressions"
                                        />
                                    </button>
                                    <button
                                        className={`editor-tab ${this.state.editorMode === 'cel' ? 'active' : ''}`}
                                        onClick={() => this.setState({editorMode: 'cel'})}
                                    >
                                        <FormattedMessage
                                            id="admin.access_control.editor.cel"
                                            defaultMessage="Advanced Expressions"
                                        />
                                    </button>
                                </div>
                                {this.state.editorMode === 'cel' ? (
                                    <CELEditor
                                        value={this.state.expression}
                                        onChange={this.handleExpressionChange}
                                        onValidate={() => {}}
                                    />
                                ) : (
                                    <TableEditor
                                        value={this.state.expression}
                                        onChange={this.handleExpressionChange}
                                        onValidate={() => {}}
                                        userAttributes={userAttributes}
                                    />
                                )}
                            </Card.Body>
                            {this.state.addChannelOpen &&
                            <ChannelSelectorModal
                                onModalDismissed={this.closeAddChannel}
                                onChannelsSelected={(channels) => {
                                    this.addToNewChannels(channels);
                                }}
                                groupID={''}
                                alreadySelected={
                                    Object.values(this.state.newChannels).map(channel => channel.id)
                                }
                                excludeAccessControlPolicyEnforced={true}
                                excludeTypes={['O', 'D', 'G']}
                            />
                            }
                        </Card>
                        <Card
                            expanded={true}
                            className={'console'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.channel_selector.title'
                                            defaultMessage='Assigned channels'
                                        />
                                    }
                                    subtitle={
                                        <FormattedMessage
                                            id='admin.daccess_control.policy.edit_policy.channel_selector.subTitle'
                                            defaultMessage='Add channels that this property based access policy will apply to.'
                                        />
                                    }
                                    buttonText={
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.channel_selector.addChannels'
                                            defaultMessage='Add channels'
                                        />
                                    }
                                    onClick={
                                        this.openAddChannel
                                    }
                                />
                            </Card.Header>
                            <Card.Body
                                expanded={true}
                            >
                                <ChannelList
                                    onRemoveCallback={this.addToRemovedChannels}
                                    onUndoRemoveCallback={this.undoRemovedChannels}
                                    onAddCallback={this.addToNewChannels}
                                    channelsToRemove={this.state.removedChannels}
                                    channelsToAdd={this.state.newChannels}
                                    policyId={
                                        this.props.policyId
                                    }
                                />
                            </Card.Body>
                        </Card>
                    </div>
                </div>
                <div className='admin-console-save'>
                    <SaveButton
                        // saving={this.state.saving}
                        
                        disabled={!this.state.saveNeeded}
                        onClick={this.handleSubmit}
                        defaultMessage={(
                            <FormattedMessage
                                id='admin.access_control.edit_policy.save'
                                defaultMessage='Save'
                            />
                        )}
                    />
                    <BlockableLink
                        className='btn btn-danger'
                        onClick={this.handleDelete}
                        to='/admin_console/user_management/attribute_based_access_control'
                    >
                    <FormattedMessage
                        id='admin.access_control.edit_policy.delete'
                        defaultMessage='Delete'
                    />
                    </BlockableLink>
                    <BlockableLink
                        className='btn btn-quaternary'
                        to='/admin_console/user_management/attribute_based_access_control'
                    >
                    <FormattedMessage
                        id='admin.access_control.edit_policy.cancel'
                        defaultMessage='Cancel'
                    />
                    </BlockableLink>
                    {serverError &&
                        <span className='EditPolicy__error'>
                            <i className='icon icon-alert-outline'/>
                            <FormattedMessage
                                id='admin.access_control.edit_policy.serverError'
                                defaultMessage='There are errors in the form above'
                            />
                        </span>
                    }
                </div>
            </div>
        );
    }
} 