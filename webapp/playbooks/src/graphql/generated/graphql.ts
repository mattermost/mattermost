/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Action = {
  __typename?: 'Action';
  payload: Scalars['String'];
  type: Scalars['String'];
};

export type ActionUpdates = {
  payload: Scalars['String'];
  type: Scalars['String'];
};

export type Checklist = {
  __typename?: 'Checklist';
  items: Array<ChecklistItem>;
  title: Scalars['String'];
};

export type ChecklistItem = {
  __typename?: 'ChecklistItem';
  assigneeID: Scalars['String'];
  assigneeModified: Scalars['Float'];
  command: Scalars['String'];
  commandLastRun: Scalars['Float'];
  description: Scalars['String'];
  dueDate: Scalars['Float'];
  state: Scalars['String'];
  stateModified: Scalars['Float'];
  taskActions: Array<TaskAction>;
  title: Scalars['String'];
};

export type ChecklistItemUpdates = {
  assigneeID: Scalars['String'];
  assigneeModified: Scalars['Float'];
  command: Scalars['String'];
  commandLastRun: Scalars['Float'];
  description: Scalars['String'];
  dueDate: Scalars['Float'];
  state: Scalars['String'];
  stateModified: Scalars['Float'];
  taskActions?: InputMaybe<Array<TaskActionUpdates>>;
  title: Scalars['String'];
};

export type ChecklistUpdates = {
  items: Array<ChecklistItemUpdates>;
  title: Scalars['String'];
};

export type Member = {
  __typename?: 'Member';
  roles: Array<Scalars['String']>;
  schemeRoles: Array<Scalars['String']>;
  userID: Scalars['String'];
};

export enum MetricType {
  MetricCurrency = 'metric_currency',
  MetricDuration = 'metric_duration',
  MetricInteger = 'metric_integer'
}

export type Mutation = {
  __typename?: 'Mutation';
  addMetric: Scalars['String'];
  addPlaybookMember: Scalars['String'];
  addRunParticipants: Scalars['String'];
  changeRunOwner: Scalars['String'];
  deleteMetric: Scalars['String'];
  removePlaybookMember: Scalars['String'];
  removeRunParticipants: Scalars['String'];
  setRunFavorite: Scalars['String'];
  updateMetric: Scalars['String'];
  updatePlaybook: Scalars['String'];
  updatePlaybookFavorite: Scalars['String'];
  updateRun: Scalars['String'];
  updateRunTaskActions: Scalars['String'];
};


export type MutationAddMetricArgs = {
  description: Scalars['String'];
  playbookID: Scalars['String'];
  target?: InputMaybe<Scalars['Int']>;
  title: Scalars['String'];
  type: Scalars['String'];
};


export type MutationAddPlaybookMemberArgs = {
  playbookID: Scalars['String'];
  userID: Scalars['String'];
};


export type MutationAddRunParticipantsArgs = {
  forceAddToChannel?: InputMaybe<Scalars['Boolean']>;
  runID: Scalars['String'];
  userIDs: Array<Scalars['String']>;
};


export type MutationChangeRunOwnerArgs = {
  ownerID: Scalars['String'];
  runID: Scalars['String'];
};


export type MutationDeleteMetricArgs = {
  id: Scalars['String'];
};


export type MutationRemovePlaybookMemberArgs = {
  playbookID: Scalars['String'];
  userID: Scalars['String'];
};


export type MutationRemoveRunParticipantsArgs = {
  runID: Scalars['String'];
  userIDs: Array<Scalars['String']>;
};


export type MutationSetRunFavoriteArgs = {
  fav: Scalars['Boolean'];
  id: Scalars['String'];
};


export type MutationUpdateMetricArgs = {
  description?: InputMaybe<Scalars['String']>;
  id: Scalars['String'];
  target?: InputMaybe<Scalars['Int']>;
  title?: InputMaybe<Scalars['String']>;
};


export type MutationUpdatePlaybookArgs = {
  id: Scalars['String'];
  updates: PlaybookUpdates;
};


export type MutationUpdatePlaybookFavoriteArgs = {
  favorite: Scalars['Boolean'];
  id: Scalars['String'];
};


export type MutationUpdateRunArgs = {
  id: Scalars['String'];
  updates: RunUpdates;
};


export type MutationUpdateRunTaskActionsArgs = {
  checklistNum: Scalars['Float'];
  itemNum: Scalars['Float'];
  runID: Scalars['String'];
  taskActions?: InputMaybe<Array<TaskActionUpdates>>;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor: Scalars['String'];
  hasNextPage: Scalars['Boolean'];
  startCursor: Scalars['String'];
};

export type Playbook = {
  __typename?: 'Playbook';
  activeRuns: Scalars['Int'];
  broadcastChannelIDs: Array<Scalars['String']>;
  broadcastEnabled: Scalars['Boolean'];
  categorizeChannelEnabled: Scalars['Boolean'];
  categoryName: Scalars['String'];
  channelID: Scalars['String'];
  channelMode: Scalars['String'];
  channelNameTemplate: Scalars['String'];
  checklists: Array<Checklist>;
  createChannelMemberOnNewParticipant: Scalars['Boolean'];
  createPublicPlaybookRun: Scalars['Boolean'];
  defaultOwnerEnabled: Scalars['Boolean'];
  defaultOwnerID: Scalars['String'];
  defaultPlaybookAdminRole: Scalars['String'];
  defaultPlaybookMemberRole: Scalars['String'];
  defaultRunAdminRole: Scalars['String'];
  defaultRunMemberRole: Scalars['String'];
  deleteAt: Scalars['Float'];
  description: Scalars['String'];
  id: Scalars['String'];
  inviteUsersEnabled: Scalars['Boolean'];
  invitedGroupIDs: Array<Scalars['String']>;
  invitedUserIDs: Array<Scalars['String']>;
  isFavorite: Scalars['Boolean'];
  lastRunAt: Scalars['Float'];
  members: Array<Member>;
  messageOnJoin: Scalars['String'];
  messageOnJoinEnabled: Scalars['Boolean'];
  metrics: Array<PlaybookMetricConfig>;
  numRuns: Scalars['Int'];
  public: Scalars['Boolean'];
  reminderMessageTemplate: Scalars['String'];
  reminderTimerDefaultSeconds: Scalars['Float'];
  removeChannelMemberOnRemovedParticipant: Scalars['Boolean'];
  retrospectiveEnabled: Scalars['Boolean'];
  retrospectiveReminderIntervalSeconds: Scalars['Float'];
  retrospectiveTemplate: Scalars['String'];
  runSummaryTemplate: Scalars['String'];
  runSummaryTemplateEnabled: Scalars['Boolean'];
  signalAnyKeywords: Array<Scalars['String']>;
  signalAnyKeywordsEnabled: Scalars['Boolean'];
  statusUpdateEnabled: Scalars['Boolean'];
  teamID: Scalars['String'];
  title: Scalars['String'];
  webhookOnCreationEnabled: Scalars['Boolean'];
  webhookOnCreationURLs: Array<Scalars['String']>;
  webhookOnStatusUpdateEnabled: Scalars['Boolean'];
  webhookOnStatusUpdateURLs: Array<Scalars['String']>;
};

export type PlaybookMetricConfig = {
  __typename?: 'PlaybookMetricConfig';
  description: Scalars['String'];
  id: Scalars['String'];
  target?: Maybe<Scalars['Int']>;
  title: Scalars['String'];
  type: MetricType;
};

export enum PlaybookRunType {
  ChannelChecklist = 'channelChecklist',
  Playbook = 'playbook'
}

export type PlaybookUpdates = {
  broadcastChannelIDs?: InputMaybe<Array<Scalars['String']>>;
  broadcastEnabled?: InputMaybe<Scalars['Boolean']>;
  categorizeChannelEnabled?: InputMaybe<Scalars['Boolean']>;
  categoryName?: InputMaybe<Scalars['String']>;
  channelId?: InputMaybe<Scalars['String']>;
  channelMode?: InputMaybe<Scalars['String']>;
  channelNameTemplate?: InputMaybe<Scalars['String']>;
  checklists?: InputMaybe<Array<ChecklistUpdates>>;
  createChannelMemberOnNewParticipant?: InputMaybe<Scalars['Boolean']>;
  createPublicPlaybookRun?: InputMaybe<Scalars['Boolean']>;
  defaultOwnerEnabled?: InputMaybe<Scalars['Boolean']>;
  defaultOwnerID?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  inviteUsersEnabled?: InputMaybe<Scalars['Boolean']>;
  invitedGroupIDs?: InputMaybe<Array<Scalars['String']>>;
  invitedUserIDs?: InputMaybe<Array<Scalars['String']>>;
  messageOnJoin?: InputMaybe<Scalars['String']>;
  messageOnJoinEnabled?: InputMaybe<Scalars['Boolean']>;
  public?: InputMaybe<Scalars['Boolean']>;
  reminderMessageTemplate?: InputMaybe<Scalars['String']>;
  reminderTimerDefaultSeconds?: InputMaybe<Scalars['Float']>;
  removeChannelMemberOnRemovedParticipant?: InputMaybe<Scalars['Boolean']>;
  retrospectiveEnabled?: InputMaybe<Scalars['Boolean']>;
  retrospectiveReminderIntervalSeconds?: InputMaybe<Scalars['Float']>;
  retrospectiveTemplate?: InputMaybe<Scalars['String']>;
  runSummaryTemplate?: InputMaybe<Scalars['String']>;
  runSummaryTemplateEnabled?: InputMaybe<Scalars['Boolean']>;
  signalAnyKeywords?: InputMaybe<Array<Scalars['String']>>;
  signalAnyKeywordsEnabled?: InputMaybe<Scalars['Boolean']>;
  statusUpdateEnabled?: InputMaybe<Scalars['Boolean']>;
  title?: InputMaybe<Scalars['String']>;
  webhookOnCreationEnabled?: InputMaybe<Scalars['Boolean']>;
  webhookOnCreationURLs?: InputMaybe<Array<Scalars['String']>>;
  webhookOnStatusUpdateEnabled?: InputMaybe<Scalars['Boolean']>;
  webhookOnStatusUpdateURLs?: InputMaybe<Array<Scalars['String']>>;
};

export type Query = {
  __typename?: 'Query';
  playbook?: Maybe<Playbook>;
  playbooks: Array<Playbook>;
  run?: Maybe<Run>;
  runs: RunConnection;
};


export type QueryPlaybookArgs = {
  id: Scalars['String'];
};


export type QueryPlaybooksArgs = {
  direction?: InputMaybe<Scalars['String']>;
  searchTerm?: InputMaybe<Scalars['String']>;
  sort?: InputMaybe<Scalars['String']>;
  teamID?: InputMaybe<Scalars['String']>;
  withArchived?: InputMaybe<Scalars['Boolean']>;
  withMembershipOnly?: InputMaybe<Scalars['Boolean']>;
};


export type QueryRunArgs = {
  id: Scalars['String'];
};


export type QueryRunsArgs = {
  after?: InputMaybe<Scalars['String']>;
  channelID?: InputMaybe<Scalars['String']>;
  direction?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  participantOrFollowerID?: InputMaybe<Scalars['String']>;
  sort?: InputMaybe<Scalars['String']>;
  statuses?: InputMaybe<Array<Scalars['String']>>;
  teamID?: InputMaybe<Scalars['String']>;
  types?: InputMaybe<Array<PlaybookRunType>>;
};

export type Run = {
  __typename?: 'Run';
  broadcastChannelIDs: Array<Scalars['String']>;
  channelID: Scalars['String'];
  checklists: Array<Checklist>;
  createAt: Scalars['Float'];
  createChannelMemberOnNewParticipant: Scalars['Boolean'];
  currentStatus: Scalars['String'];
  endAt: Scalars['Float'];
  followers: Array<Scalars['String']>;
  id: Scalars['String'];
  isFavorite: Scalars['Boolean'];
  lastStatusUpdateAt: Scalars['Float'];
  lastUpdatedAt: Scalars['Float'];
  name: Scalars['String'];
  numTasks: Scalars['Int'];
  numTasksClosed: Scalars['Int'];
  ownerUserID: Scalars['String'];
  participantIDs: Array<Scalars['String']>;
  playbook?: Maybe<Playbook>;
  playbookID: Scalars['String'];
  postID: Scalars['String'];
  previousReminder: Scalars['Float'];
  reminderMessageTemplate: Scalars['String'];
  reminderPostId: Scalars['String'];
  reminderTimerDefaultSeconds: Scalars['Float'];
  removeChannelMemberOnRemovedParticipant: Scalars['Boolean'];
  retrospective: Scalars['String'];
  retrospectiveEnabled: Scalars['Boolean'];
  retrospectivePublishedAt: Scalars['Float'];
  retrospectiveReminderIntervalSeconds: Scalars['Float'];
  retrospectiveWasCanceled: Scalars['Boolean'];
  statusPosts: Array<StatusPost>;
  statusUpdateBroadcastChannelsEnabled: Scalars['Boolean'];
  statusUpdateBroadcastWebhooksEnabled: Scalars['Boolean'];
  statusUpdateEnabled: Scalars['Boolean'];
  summary: Scalars['String'];
  summaryModifiedAt: Scalars['Float'];
  teamID: Scalars['String'];
  timelineEvents: Array<TimelineEvent>;
  type: PlaybookRunType;
  webhookOnStatusUpdateURLs: Array<Scalars['String']>;
};

export type RunConnection = {
  __typename?: 'RunConnection';
  edges: Array<RunEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int'];
};

export type RunEdge = {
  __typename?: 'RunEdge';
  cursor: Scalars['String'];
  node: Run;
};

export type RunUpdates = {
  broadcastChannelIDs?: InputMaybe<Array<Scalars['String']>>;
  channelID?: InputMaybe<Scalars['String']>;
  createChannelMemberOnNewParticipant?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  removeChannelMemberOnRemovedParticipant?: InputMaybe<Scalars['Boolean']>;
  statusUpdateBroadcastChannelsEnabled?: InputMaybe<Scalars['Boolean']>;
  statusUpdateBroadcastWebhooksEnabled?: InputMaybe<Scalars['Boolean']>;
  summary?: InputMaybe<Scalars['String']>;
  webhookOnStatusUpdateURLs?: InputMaybe<Array<Scalars['String']>>;
};

export type StatusPost = {
  __typename?: 'StatusPost';
  createAt: Scalars['Float'];
  deleteAt: Scalars['Float'];
  id: Scalars['String'];
};

export type TaskAction = {
  __typename?: 'TaskAction';
  actions: Array<Action>;
  trigger: Trigger;
};

export type TaskActionUpdates = {
  actions: Array<ActionUpdates>;
  trigger: TriggerUpdates;
};

export type TimelineEvent = {
  __typename?: 'TimelineEvent';
  createAt: Scalars['Float'];
  creatorUserID: Scalars['String'];
  deleteAt: Scalars['Float'];
  details: Scalars['String'];
  eventType: Scalars['String'];
  id: Scalars['String'];
  postID: Scalars['String'];
  subjectUserID: Scalars['String'];
  summary: Scalars['String'];
};

export type Trigger = {
  __typename?: 'Trigger';
  payload: Scalars['String'];
  type: Scalars['String'];
};

export type TriggerUpdates = {
  payload: Scalars['String'];
  type: Scalars['String'];
};

export type RunStatusModalQueryVariables = Exact<{
  runID: Scalars['String'];
}>;


export type RunStatusModalQuery = { __typename?: 'Query', run?: (
    { __typename?: 'Run', id: string, name: string, teamID: string, broadcastChannelIDs: Array<string>, statusUpdateBroadcastChannelsEnabled: boolean, followers: Array<string>, checklists: Array<{ __typename?: 'Checklist', items: Array<{ __typename?: 'ChecklistItem', state: string }> }> }
    & { ' $fragmentRefs'?: { 'DefaultMessageFragment': DefaultMessageFragment;'ReminderTimerFragment': ReminderTimerFragment } }
  ) | null };

export type DefaultMessageFragment = { __typename?: 'Run', reminderMessageTemplate: string, statusPosts: Array<{ __typename?: 'StatusPost', id: string, deleteAt: number }> } & { ' $fragmentName'?: 'DefaultMessageFragment' };

export type ReminderTimerFragment = { __typename?: 'Run', previousReminder: number, reminderTimerDefaultSeconds: number, statusPosts: Array<{ __typename?: 'StatusPost', deleteAt: number }> } & { ' $fragmentName'?: 'ReminderTimerFragment' };

export type PlaybookModalFieldsFragment = { __typename?: 'Playbook', id: string, title: string, public: boolean, is_favorite: boolean, team_id: string, default_playbook_member_role: string, last_run_at: number, active_runs: number, members: Array<{ __typename?: 'Member', user_id: string, scheme_roles: Array<string> }> } & { ' $fragmentName'?: 'PlaybookModalFieldsFragment' };

export type PlaybooksModalQueryVariables = Exact<{
  channelID: Scalars['String'];
  teamID: Scalars['String'];
  searchTerm: Scalars['String'];
}>;


export type PlaybooksModalQuery = { __typename?: 'Query', channelPlaybooks: { __typename?: 'RunConnection', edges: Array<{ __typename?: 'RunEdge', node: { __typename?: 'Run', playbookID: string } }> }, yourPlaybooks: Array<(
    { __typename?: 'Playbook', id: string }
    & { ' $fragmentRefs'?: { 'PlaybookModalFieldsFragment': PlaybookModalFieldsFragment } }
  )>, allPlaybooks: Array<(
    { __typename?: 'Playbook', id: string }
    & { ' $fragmentRefs'?: { 'PlaybookModalFieldsFragment': PlaybookModalFieldsFragment } }
  )> };

export type RhsRunsQueryVariables = Exact<{
  channelID: Scalars['String'];
  sort: Scalars['String'];
  direction: Scalars['String'];
  status: Scalars['String'];
  first?: InputMaybe<Scalars['Int']>;
  after?: InputMaybe<Scalars['String']>;
}>;


export type RhsRunsQuery = { __typename?: 'Query', runs: { __typename?: 'RunConnection', totalCount: number, edges: Array<{ __typename?: 'RunEdge', node: { __typename?: 'Run', id: string, name: string, participantIDs: Array<string>, ownerUserID: string, playbookID: string, numTasksClosed: number, numTasks: number, lastUpdatedAt: number, type: PlaybookRunType, playbook?: { __typename?: 'Playbook', title: string } | null } }>, pageInfo: { __typename?: 'PageInfo', endCursor: string, hasNextPage: boolean } } };

export type PlaybookLhsQueryVariables = Exact<{
  userID: Scalars['String'];
  teamID: Scalars['String'];
  types?: InputMaybe<Array<PlaybookRunType> | PlaybookRunType>;
}>;


export type PlaybookLhsQuery = { __typename?: 'Query', runs: { __typename?: 'RunConnection', edges: Array<{ __typename?: 'RunEdge', node: { __typename?: 'Run', id: string, name: string, isFavorite: boolean, playbookID: string, ownerUserID: string, participantIDs: Array<string>, followers: Array<string> } }> }, playbooks: Array<{ __typename?: 'Playbook', id: string, title: string, isFavorite: boolean, public: boolean }> };

export type PlaybookRunReminderQueryVariables = Exact<{
  runID: Scalars['String'];
}>;


export type PlaybookRunReminderQuery = { __typename?: 'Query', run?: { __typename?: 'Run', id: string, name: string, previousReminder: number, reminderTimerDefaultSeconds: number } | null };

export type FirstActiveRunInChannelQueryVariables = Exact<{
  channelID: Scalars['String'];
}>;


export type FirstActiveRunInChannelQuery = { __typename?: 'Query', runs: { __typename?: 'RunConnection', edges: Array<{ __typename?: 'RunEdge', node: { __typename?: 'Run', id: string, name: string, previousReminder: number, reminderTimerDefaultSeconds: number } }> } };

export type PlaybookQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type PlaybookQuery = { __typename?: 'Query', playbook?: { __typename?: 'Playbook', id: string, title: string, description: string, public: boolean, team_id: string, delete_at: number, default_playbook_member_role: string, invited_user_ids: Array<string>, broadcast_channel_ids: Array<string>, webhook_on_creation_urls: Array<string>, reminder_timer_default_seconds: number, reminder_message_template: string, broadcast_enabled: boolean, webhook_on_status_update_enabled: boolean, webhook_on_status_update_urls: Array<string>, status_update_enabled: boolean, retrospective_enabled: boolean, retrospective_reminder_interval_seconds: number, retrospective_template: string, default_owner_id: string, run_summary_template: string, run_summary_template_enabled: boolean, message_on_join: string, category_name: string, invite_users_enabled: boolean, default_owner_enabled: boolean, webhook_on_creation_enabled: boolean, message_on_join_enabled: boolean, categorize_channel_enabled: boolean, create_public_playbook_run: boolean, channel_name_template: string, create_channel_member_on_new_participant: boolean, remove_channel_member_on_removed_participant: boolean, channel_id: string, channel_mode: string, is_favorite: boolean, checklists: Array<{ __typename?: 'Checklist', title: string, items: Array<{ __typename?: 'ChecklistItem', title: string, description: string, state: string, command: string, state_modified: number, assignee_id: string, assignee_modified: number, command_last_run: number, due_date: number, task_actions: Array<{ __typename?: 'TaskAction', trigger: { __typename?: 'Trigger', type: string, payload: string }, actions: Array<{ __typename?: 'Action', type: string, payload: string }> }> }> }>, members: Array<{ __typename?: 'Member', roles: Array<string>, user_id: string, scheme_roles: Array<string> }>, metrics: Array<{ __typename?: 'PlaybookMetricConfig', id: string, title: string, description: string, type: MetricType, target?: number | null }> } | null };

export type UpdatePlaybookFavoriteMutationVariables = Exact<{
  id: Scalars['String'];
  favorite: Scalars['Boolean'];
}>;


export type UpdatePlaybookFavoriteMutation = { __typename?: 'Mutation', updatePlaybookFavorite: string };

export type UpdatePlaybookMutationVariables = Exact<{
  id: Scalars['String'];
  updates: PlaybookUpdates;
}>;


export type UpdatePlaybookMutation = { __typename?: 'Mutation', updatePlaybook: string };

export type AddPlaybookMemberMutationVariables = Exact<{
  playbookID: Scalars['String'];
  userID: Scalars['String'];
}>;


export type AddPlaybookMemberMutation = { __typename?: 'Mutation', addPlaybookMember: string };

export type RemovePlaybookMemberMutationVariables = Exact<{
  playbookID: Scalars['String'];
  userID: Scalars['String'];
}>;


export type RemovePlaybookMemberMutation = { __typename?: 'Mutation', removePlaybookMember: string };

export type SetRunFavoriteMutationVariables = Exact<{
  id: Scalars['String'];
  fav: Scalars['Boolean'];
}>;


export type SetRunFavoriteMutation = { __typename?: 'Mutation', setRunFavorite: string };

export type UpdateRunMutationVariables = Exact<{
  id: Scalars['String'];
  updates: RunUpdates;
}>;


export type UpdateRunMutation = { __typename?: 'Mutation', updateRun: string };

export type AddRunParticipantsMutationVariables = Exact<{
  runID: Scalars['String'];
  userIDs: Array<Scalars['String']> | Scalars['String'];
  forceAddToChannel?: InputMaybe<Scalars['Boolean']>;
}>;


export type AddRunParticipantsMutation = { __typename?: 'Mutation', addRunParticipants: string };

export type RemoveRunParticipantsMutationVariables = Exact<{
  runID: Scalars['String'];
  userIDs: Array<Scalars['String']> | Scalars['String'];
}>;


export type RemoveRunParticipantsMutation = { __typename?: 'Mutation', removeRunParticipants: string };

export type ChangeRunOwnerMutationVariables = Exact<{
  runID: Scalars['String'];
  ownerID: Scalars['String'];
}>;


export type ChangeRunOwnerMutation = { __typename?: 'Mutation', changeRunOwner: string };

export type UpdateRunTaskActionsMutationVariables = Exact<{
  runID: Scalars['String'];
  checklistNum: Scalars['Float'];
  itemNum: Scalars['Float'];
  taskActions: Array<TaskActionUpdates> | TaskActionUpdates;
}>;


export type UpdateRunTaskActionsMutation = { __typename?: 'Mutation', updateRunTaskActions: string };

export const DefaultMessageFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DefaultMessage"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Run"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reminderMessageTemplate"}},{"kind":"Field","name":{"kind":"Name","value":"statusPosts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"deleteAt"}}]}}]}}]} as unknown as DocumentNode<DefaultMessageFragment, unknown>;
export const ReminderTimerFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReminderTimer"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Run"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"previousReminder"}},{"kind":"Field","name":{"kind":"Name","value":"reminderTimerDefaultSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"statusPosts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAt"}}]}}]}}]} as unknown as DocumentNode<ReminderTimerFragment, unknown>;
export const PlaybookModalFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PlaybookModalFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Playbook"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","alias":{"kind":"Name","value":"is_favorite"},"name":{"kind":"Name","value":"isFavorite"}},{"kind":"Field","name":{"kind":"Name","value":"public"}},{"kind":"Field","alias":{"kind":"Name","value":"team_id"},"name":{"kind":"Name","value":"teamID"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"user_id"},"name":{"kind":"Name","value":"userID"}},{"kind":"Field","alias":{"kind":"Name","value":"scheme_roles"},"name":{"kind":"Name","value":"schemeRoles"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"default_playbook_member_role"},"name":{"kind":"Name","value":"defaultPlaybookMemberRole"}},{"kind":"Field","alias":{"kind":"Name","value":"last_run_at"},"name":{"kind":"Name","value":"lastRunAt"}},{"kind":"Field","alias":{"kind":"Name","value":"active_runs"},"name":{"kind":"Name","value":"activeRuns"}}]}}]} as unknown as DocumentNode<PlaybookModalFieldsFragment, unknown>;
export const RunStatusModalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RunStatusModal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"run"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"teamID"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"DefaultMessage"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReminderTimer"}},{"kind":"Field","name":{"kind":"Name","value":"broadcastChannelIDs"}},{"kind":"Field","name":{"kind":"Name","value":"statusUpdateBroadcastChannelsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"checklists"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}},...DefaultMessageFragmentDoc.definitions,...ReminderTimerFragmentDoc.definitions]} as unknown as DocumentNode<RunStatusModalQuery, RunStatusModalQueryVariables>;
export const PlaybooksModalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlaybooksModal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"channelID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"teamID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchTerm"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"channelPlaybooks"},"name":{"kind":"Name","value":"runs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"channelID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"channelID"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"playbookID"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"yourPlaybooks"},"name":{"kind":"Name","value":"playbooks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"teamID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"teamID"}}},{"kind":"Argument","name":{"kind":"Name","value":"withMembershipOnly"},"value":{"kind":"BooleanValue","value":true}},{"kind":"Argument","name":{"kind":"Name","value":"searchTerm"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchTerm"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"PlaybookModalFields"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"allPlaybooks"},"name":{"kind":"Name","value":"playbooks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"teamID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"teamID"}}},{"kind":"Argument","name":{"kind":"Name","value":"withMembershipOnly"},"value":{"kind":"BooleanValue","value":false}},{"kind":"Argument","name":{"kind":"Name","value":"searchTerm"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchTerm"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"PlaybookModalFields"}}]}}]}},...PlaybookModalFieldsFragmentDoc.definitions]} as unknown as DocumentNode<PlaybooksModalQuery, PlaybooksModalQueryVariables>;
export const RhsRunsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RHSRuns"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"channelID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sort"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"direction"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"channelID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"channelID"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sort"}}},{"kind":"Argument","name":{"kind":"Name","value":"direction"},"value":{"kind":"Variable","name":{"kind":"Name","value":"direction"}}},{"kind":"Argument","name":{"kind":"Name","value":"statuses"},"value":{"kind":"ListValue","values":[{"kind":"Variable","name":{"kind":"Name","value":"status"}}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"participantIDs"}},{"kind":"Field","name":{"kind":"Name","value":"ownerUserID"}},{"kind":"Field","name":{"kind":"Name","value":"playbookID"}},{"kind":"Field","name":{"kind":"Name","value":"playbook"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numTasksClosed"}},{"kind":"Field","name":{"kind":"Name","value":"numTasks"}},{"kind":"Field","name":{"kind":"Name","value":"lastUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}}]}}]}}]} as unknown as DocumentNode<RhsRunsQuery, RhsRunsQueryVariables>;
export const PlaybookLhsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlaybookLHS"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"teamID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"types"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlaybookRunType"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"participantOrFollowerID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}},{"kind":"Argument","name":{"kind":"Name","value":"teamID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"teamID"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"StringValue","value":"name","block":false}},{"kind":"Argument","name":{"kind":"Name","value":"statuses"},"value":{"kind":"ListValue","values":[{"kind":"StringValue","value":"InProgress","block":false}]}},{"kind":"Argument","name":{"kind":"Name","value":"types"},"value":{"kind":"Variable","name":{"kind":"Name","value":"types"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isFavorite"}},{"kind":"Field","name":{"kind":"Name","value":"playbookID"}},{"kind":"Field","name":{"kind":"Name","value":"ownerUserID"}},{"kind":"Field","name":{"kind":"Name","value":"participantIDs"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"playbooks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"teamID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"teamID"}}},{"kind":"Argument","name":{"kind":"Name","value":"withMembershipOnly"},"value":{"kind":"BooleanValue","value":true}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isFavorite"}},{"kind":"Field","name":{"kind":"Name","value":"public"}}]}}]}}]} as unknown as DocumentNode<PlaybookLhsQuery, PlaybookLhsQueryVariables>;
export const PlaybookRunReminderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlaybookRunReminder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"run"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"previousReminder"}},{"kind":"Field","name":{"kind":"Name","value":"reminderTimerDefaultSeconds"}}]}}]}}]} as unknown as DocumentNode<PlaybookRunReminderQuery, PlaybookRunReminderQueryVariables>;
export const FirstActiveRunInChannelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FirstActiveRunInChannel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"channelID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"channelID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"channelID"}}},{"kind":"Argument","name":{"kind":"Name","value":"statuses"},"value":{"kind":"ListValue","values":[{"kind":"StringValue","value":"InProgress","block":false}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"previousReminder"}},{"kind":"Field","name":{"kind":"Name","value":"reminderTimerDefaultSeconds"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FirstActiveRunInChannelQuery, FirstActiveRunInChannelQueryVariables>;
export const PlaybookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Playbook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"playbook"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","alias":{"kind":"Name","value":"team_id"},"name":{"kind":"Name","value":"teamID"}},{"kind":"Field","name":{"kind":"Name","value":"public"}},{"kind":"Field","alias":{"kind":"Name","value":"delete_at"},"name":{"kind":"Name","value":"deleteAt"}},{"kind":"Field","alias":{"kind":"Name","value":"default_playbook_member_role"},"name":{"kind":"Name","value":"defaultPlaybookMemberRole"}},{"kind":"Field","alias":{"kind":"Name","value":"invited_user_ids"},"name":{"kind":"Name","value":"invitedUserIDs"}},{"kind":"Field","alias":{"kind":"Name","value":"broadcast_channel_ids"},"name":{"kind":"Name","value":"broadcastChannelIDs"}},{"kind":"Field","alias":{"kind":"Name","value":"webhook_on_creation_urls"},"name":{"kind":"Name","value":"webhookOnCreationURLs"}},{"kind":"Field","alias":{"kind":"Name","value":"reminder_timer_default_seconds"},"name":{"kind":"Name","value":"reminderTimerDefaultSeconds"}},{"kind":"Field","alias":{"kind":"Name","value":"reminder_message_template"},"name":{"kind":"Name","value":"reminderMessageTemplate"}},{"kind":"Field","alias":{"kind":"Name","value":"broadcast_enabled"},"name":{"kind":"Name","value":"broadcastEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"webhook_on_status_update_enabled"},"name":{"kind":"Name","value":"webhookOnStatusUpdateEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"webhook_on_status_update_urls"},"name":{"kind":"Name","value":"webhookOnStatusUpdateURLs"}},{"kind":"Field","alias":{"kind":"Name","value":"status_update_enabled"},"name":{"kind":"Name","value":"statusUpdateEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"retrospective_enabled"},"name":{"kind":"Name","value":"retrospectiveEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"retrospective_reminder_interval_seconds"},"name":{"kind":"Name","value":"retrospectiveReminderIntervalSeconds"}},{"kind":"Field","alias":{"kind":"Name","value":"retrospective_template"},"name":{"kind":"Name","value":"retrospectiveTemplate"}},{"kind":"Field","alias":{"kind":"Name","value":"default_owner_id"},"name":{"kind":"Name","value":"defaultOwnerID"}},{"kind":"Field","alias":{"kind":"Name","value":"run_summary_template"},"name":{"kind":"Name","value":"runSummaryTemplate"}},{"kind":"Field","alias":{"kind":"Name","value":"run_summary_template_enabled"},"name":{"kind":"Name","value":"runSummaryTemplateEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"message_on_join"},"name":{"kind":"Name","value":"messageOnJoin"}},{"kind":"Field","alias":{"kind":"Name","value":"category_name"},"name":{"kind":"Name","value":"categoryName"}},{"kind":"Field","alias":{"kind":"Name","value":"invite_users_enabled"},"name":{"kind":"Name","value":"inviteUsersEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"default_owner_enabled"},"name":{"kind":"Name","value":"defaultOwnerEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"webhook_on_creation_enabled"},"name":{"kind":"Name","value":"webhookOnCreationEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"message_on_join_enabled"},"name":{"kind":"Name","value":"messageOnJoinEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"categorize_channel_enabled"},"name":{"kind":"Name","value":"categorizeChannelEnabled"}},{"kind":"Field","alias":{"kind":"Name","value":"create_public_playbook_run"},"name":{"kind":"Name","value":"createPublicPlaybookRun"}},{"kind":"Field","alias":{"kind":"Name","value":"channel_name_template"},"name":{"kind":"Name","value":"channelNameTemplate"}},{"kind":"Field","alias":{"kind":"Name","value":"create_channel_member_on_new_participant"},"name":{"kind":"Name","value":"createChannelMemberOnNewParticipant"}},{"kind":"Field","alias":{"kind":"Name","value":"remove_channel_member_on_removed_participant"},"name":{"kind":"Name","value":"removeChannelMemberOnRemovedParticipant"}},{"kind":"Field","alias":{"kind":"Name","value":"channel_id"},"name":{"kind":"Name","value":"channelID"}},{"kind":"Field","alias":{"kind":"Name","value":"channel_mode"},"name":{"kind":"Name","value":"channelMode"}},{"kind":"Field","alias":{"kind":"Name","value":"is_favorite"},"name":{"kind":"Name","value":"isFavorite"}},{"kind":"Field","name":{"kind":"Name","value":"checklists"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","alias":{"kind":"Name","value":"state_modified"},"name":{"kind":"Name","value":"stateModified"}},{"kind":"Field","alias":{"kind":"Name","value":"assignee_id"},"name":{"kind":"Name","value":"assigneeID"}},{"kind":"Field","alias":{"kind":"Name","value":"assignee_modified"},"name":{"kind":"Name","value":"assigneeModified"}},{"kind":"Field","name":{"kind":"Name","value":"command"}},{"kind":"Field","alias":{"kind":"Name","value":"command_last_run"},"name":{"kind":"Name","value":"commandLastRun"}},{"kind":"Field","alias":{"kind":"Name","value":"due_date"},"name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","alias":{"kind":"Name","value":"task_actions"},"name":{"kind":"Name","value":"taskActions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"trigger"},"name":{"kind":"Name","value":"trigger"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"payload"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"actions"},"name":{"kind":"Name","value":"actions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"payload"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"user_id"},"name":{"kind":"Name","value":"userID"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}},{"kind":"Field","alias":{"kind":"Name","value":"scheme_roles"},"name":{"kind":"Name","value":"schemeRoles"}}]}},{"kind":"Field","name":{"kind":"Name","value":"metrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"target"}}]}}]}}]}}]} as unknown as DocumentNode<PlaybookQuery, PlaybookQueryVariables>;
export const UpdatePlaybookFavoriteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePlaybookFavorite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"favorite"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePlaybookFavorite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"favorite"},"value":{"kind":"Variable","name":{"kind":"Name","value":"favorite"}}}]}]}}]} as unknown as DocumentNode<UpdatePlaybookFavoriteMutation, UpdatePlaybookFavoriteMutationVariables>;
export const UpdatePlaybookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePlaybook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"updates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlaybookUpdates"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePlaybook"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"updates"}}}]}]}}]} as unknown as DocumentNode<UpdatePlaybookMutation, UpdatePlaybookMutationVariables>;
export const AddPlaybookMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddPlaybookMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"playbookID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addPlaybookMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"playbookID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"playbookID"}}},{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}]}}]} as unknown as DocumentNode<AddPlaybookMemberMutation, AddPlaybookMemberMutationVariables>;
export const RemovePlaybookMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemovePlaybookMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"playbookID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removePlaybookMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"playbookID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"playbookID"}}},{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}]}}]} as unknown as DocumentNode<RemovePlaybookMemberMutation, RemovePlaybookMemberMutationVariables>;
export const SetRunFavoriteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetRunFavorite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fav"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setRunFavorite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"fav"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fav"}}}]}]}}]} as unknown as DocumentNode<SetRunFavoriteMutation, SetRunFavoriteMutationVariables>;
export const UpdateRunDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRun"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"updates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RunUpdates"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRun"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"updates"}}}]}]}}]} as unknown as DocumentNode<UpdateRunMutation, UpdateRunMutationVariables>;
export const AddRunParticipantsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddRunParticipants"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userIDs"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"forceAddToChannel"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}},"defaultValue":{"kind":"BooleanValue","value":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addRunParticipants"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"runID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runID"}}},{"kind":"Argument","name":{"kind":"Name","value":"userIDs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userIDs"}}},{"kind":"Argument","name":{"kind":"Name","value":"forceAddToChannel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"forceAddToChannel"}}}]}]}}]} as unknown as DocumentNode<AddRunParticipantsMutation, AddRunParticipantsMutationVariables>;
export const RemoveRunParticipantsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveRunParticipants"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userIDs"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeRunParticipants"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"runID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runID"}}},{"kind":"Argument","name":{"kind":"Name","value":"userIDs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userIDs"}}}]}]}}]} as unknown as DocumentNode<RemoveRunParticipantsMutation, RemoveRunParticipantsMutationVariables>;
export const ChangeRunOwnerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeRunOwner"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ownerID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeRunOwner"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"runID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runID"}}},{"kind":"Argument","name":{"kind":"Name","value":"ownerID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ownerID"}}}]}]}}]} as unknown as DocumentNode<ChangeRunOwnerMutation, ChangeRunOwnerMutationVariables>;
export const UpdateRunTaskActionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRunTaskActions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"checklistNum"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"itemNum"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskActions"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TaskActionUpdates"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRunTaskActions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"runID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runID"}}},{"kind":"Argument","name":{"kind":"Name","value":"checklistNum"},"value":{"kind":"Variable","name":{"kind":"Name","value":"checklistNum"}}},{"kind":"Argument","name":{"kind":"Name","value":"itemNum"},"value":{"kind":"Variable","name":{"kind":"Name","value":"itemNum"}}},{"kind":"Argument","name":{"kind":"Name","value":"taskActions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskActions"}}}]}]}}]} as unknown as DocumentNode<UpdateRunTaskActionsMutation, UpdateRunTaskActionsMutationVariables>;