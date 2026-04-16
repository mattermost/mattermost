# Graph Report - server/ABAC-core  (2026-04-14)

## Corpus Check
- Corpus is ~13,977 words - fits in a single context window. You may not need a graph.

## Summary
- 219 nodes · 315 edges · 21 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Property Access Control Service|Property Access Control Service]]
- [[_COMMUNITY_API4 Policy Handlers|API4 Policy Handlers]]
- [[_COMMUNITY_App Layer & Sync Job Orchestration|App Layer & Sync Job Orchestration]]
- [[_COMMUNITY_SQL Policy Store|SQL Policy Store]]
- [[_COMMUNITY_Local Access Control Helpers|Local Access Control Helpers]]
- [[_COMMUNITY_Job Model|Job Model]]
- [[_COMMUNITY_Caller ID & Plugin Checker|Caller ID & Plugin Checker]]
- [[_COMMUNITY_Policy CRUD Handlers|Policy CRUD Handlers]]
- [[_COMMUNITY_Sync Job Interface|Sync Job Interface]]
- [[_COMMUNITY_Context Keys & Caller ID Model|Context Keys & Caller ID Model]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `PropertyAccessService` - 44 edges
2. `App` - 34 edges
3. `SqlAccessControlPolicyStore` - 12 edges
4. `DB table: AccessControlPolicies` - 9 edges
5. `Job` - 7 edges
6. `Job deduplication: cancel pending/in-progress jobs for same policy_id` - 6 edges
7. `accessControlPolicySliceColumns()` - 5 edges
8. `PropertyService` - 5 edges
9. `App.CreateAccessControlSyncJob (deduplication handler)` - 5 edges
10. `App.AssignAccessControlPolicyToChannels (creates child policies per channel)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AccessControlSyncJobInterface (MakeWorker, MakeScheduler)` --shares_data_with--> `DB table: AccessControlPolicies`  [INFERRED]
  einterfaces_job_access_control.go → store_access_control_policy.go
- `Job deduplication: cancel pending/in-progress jobs for same policy_id` --rationale_for--> `AccessControlSyncJobInterface (MakeWorker, MakeScheduler)`  [INFERRED]
  app_job.go → einterfaces_job_access_control.go
- `App.AssignAccessControlPolicyToChannels (creates child policies per channel)` --calls--> `AccessControlServiceInterface (PAP + PDP)`  [EXTRACTED]
  access_control.go → einterfaces_access_control.go
- `App.CreateAccessControlSyncJob (deduplication handler)` --conceptually_related_to--> `AccessControlPolicyTypeChannel (channel policy; ID == channelID)`  [INFERRED]
  app_job.go → access_control.go
- `API4 assignAccessPolicy handler` --calls--> `App.AssignAccessControlPolicyToChannels (creates child policies per channel)`  [EXTRACTED]
  api4_access_control.go → access_control.go

## Hyperedges (group relationships)
- **Access Control Sync Job Creation and Deduplication Flow** — app_App_CreateJob, app_App_CreateAccessControlSyncJob, store_Job_GetByTypeAndData, job_data_policy_id_key, job_deduplication_logic, model_JobTypeAccessControlSync [EXTRACTED 0.95]
- **ABAC Policy Persistence (AccessControlPolicies + History tables)** — store_SqlAccessControlPolicyStore, store_AccessControlPolicies_table, store_AccessControlPolicyHistory_table, store_SqlAccessControlPolicyStore_Save, model_AccessControlPolicy [EXTRACTED 0.95]
- **Channel Policy Assignment Lifecycle (assign, unassign, active-toggle)** — app_App_AssignAccessControlPolicyToChannels, app_App_UnassignPoliciesFromChannels, app_App_UpdateAccessControlPoliciesActive, store_AccessControlPolicies_table, channel_cache_invalidation [EXTRACTED 0.90]
- **Dual-role ABAC permission gate (system admin vs channel admin)** — permission_ManageSystem, permission_ManageChannelAccessRules, app_App_SessionHasPermissionToCreateJob, app_App_ValidateAccessControlPolicyPermission, app_App_ValidateChannelAccessControlPermission [EXTRACTED 0.92]
- **CEL Expression Evaluation Flow (check, test, validate, visual AST)** — api4_checkExpression, api4_testExpression, api4_convertToVisualAST, app_App_CheckExpression, app_App_TestExpression, app_App_TestExpressionWithChannelContext, einterfaces_AccessControlServiceInterface [EXTRACTED 0.90]
- **Property Field to ABAC Policy Bridge (CPA group fields as CEL attributes)** — cpa_group_property_fields, properties_PropertyService, properties_PropertyAccessService, store_SqlAccessControlPolicyStore_GetPoliciesByFieldID, app_App_GetAccessControlFieldsAutocomplete [INFERRED 0.80]

## Communities

### Community 0 - "Property Access Control Service"
Cohesion: 0.1
Nodes (2): PluginChecker, PropertyAccessService

### Community 1 - "API4 Policy Handlers"
Cohesion: 0.06
Nodes (38): API4 assignAccessPolicy handler, API4 getFieldsAutocomplete handler, API4 setActiveStatus handler (batch activate), API4 unassignAccessPolicy handler, API4 updateActiveStatus handler (deprecated single-policy activate), App.AssignAccessControlPolicyToChannels (creates child policies per channel), App.CreateAccessControlSyncJob (deduplication handler), App.CreateJob (routes ABAC jobs to CreateAccessControlSyncJob) (+30 more)

### Community 2 - "App Layer & Sync Job Orchestration"
Cohesion: 0.08
Nodes (1): App

### Community 3 - "SQL Policy Store"
Cohesion: 0.22
Nodes (8): accessControlPolicyV0_1, SqlAccessControlPolicyStore, storeAccessControlPolicy, accessControlPolicyHistorySliceColumns(), accessControlPolicySliceColumns(), fromModel(), newSqlAccessControlPolicyStore(), preSaveAccessControlPolicy()

### Community 4 - "Local Access Control Helpers"
Cohesion: 0.12
Nodes (0): 

### Community 5 - "Job Model"
Cohesion: 0.22
Nodes (3): Job, Worker, IsValidJobStatus()

### Community 6 - "Caller ID & Plugin Checker"
Cohesion: 0.24
Nodes (4): CallerIDExtractor, PropertyService, ServiceConfig, New()

### Community 7 - "Policy CRUD Handlers"
Cohesion: 0.2
Nodes (10): API4 createAccessControlPolicy handler, API4 deleteAccessControlPolicy handler, API4 getAccessControlPolicy handler, App.CreateOrUpdateAccessControlPolicy, App.DeleteAccessControlPolicy, App.GetAccessControlPolicy (delegates to AccessControl PAP), App.ValidateAccessControlPolicyPermission, App.ValidateChannelAccessControlPermission (+2 more)

### Community 8 - "Sync Job Interface"
Cohesion: 0.33
Nodes (1): AccessControlSyncJobInterface

### Community 9 - "Context Keys & Caller ID Model"
Cohesion: 0.5
Nodes (1): AccessControlContextKey

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (4): API4 testExpression handler, App.TestExpression (CEL expression test against users), App.TestExpressionWithChannelContext (channel-admin scoped test), App.ValidateExpressionAgainstRequester

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (4): API4 getChannelsForAccessControlPolicy handler, App.GetChannelsForPolicy, App.SearchAccessControlPolicies, SqlAccessControlPolicyStore.SearchPolicies

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (1): API

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): AccessControlServiceInterface

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (1): ValidateAccessControlPolicyPermissionOptions

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (2): API4 checkExpression handler, App.CheckExpression (CEL expression validation)

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (1): JobTypeAccessControlSync constant ("access_control_sync")

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (1): Job struct (Id, Type, Status, Data StringMap)

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (1): API4 convertToVisualAST handler

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (1): SqlAccessControlPolicyStore (DB store for AccessControlPolicies table)

## Knowledge Gaps
- **34 isolated node(s):** `accessControlPolicyV0_1`, `API`, `Worker`, `AccessControlContextKey`, `AccessControlServiceInterface` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (2 nodes): `API`, `.InitAccessControlPolicy()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `AccessControlServiceInterface`, `einterfaces_access_control.go`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `ValidateAccessControlPolicyPermissionOptions`, `access_control.go`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `API4 checkExpression handler`, `App.CheckExpression (CEL expression validation)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `app_job.go`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `JobTypeAccessControlSync constant ("access_control_sync")`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `Job struct (Id, Type, Status, Data StringMap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `API4 convertToVisualAST handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `SqlAccessControlPolicyStore (DB store for AccessControlPolicies table)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `DB table: AccessControlPolicies` (e.g. with `Job deduplication: cancel pending/in-progress jobs for same policy_id` and `AccessControlSyncJobInterface (MakeWorker, MakeScheduler)`) actually correct?**
  _`DB table: AccessControlPolicies` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `accessControlPolicyV0_1`, `API`, `Worker` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Property Access Control Service` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `API4 Policy Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `App Layer & Sync Job Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Local Access Control Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._