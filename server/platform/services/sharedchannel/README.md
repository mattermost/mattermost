## Shared Channel Service

Package `sharedchannel` implements Mattermost's shared channels functionality, for sharing channel content across Mattermost instances/clusters. Here are the key responsibilities:

### Channel Sharing:

- Allows channels to be shared between different Mattermost instances/clusters
- Handles inviting remote clusters to shared channels
- Manages permissions and read-only status for shared channels

### Content Synchronization:

- Syncs posts, reactions, user profiles, and file attachments between instances
- Handles permalink processing between instances
- Manages user profile images sync
- Maintains sync state and cursors to track what has been synchronized

### Remote Communication:

- Processes incoming sync messages from remote clusters
- Sends updates to remote clusters when local changes occur
- Handles connection state changes with remote clusters
- Manages retry logic for failed sync attempts

### Security:

- Validates permissions for shared channel operations
- Ensures users can only sync content they have access to
- Verifies remote cluster authenticity
- Sanitizes user data during sync

The service acts as a bridge between Mattermost instances, allowing users from different instances to collaborate in shared channels while keeping content synchronized across all participating instances.

This is implemented through a Service struct that handles all the shared channel operations and maintains the synchronization state. It works in conjunction with the RemoteCluster service to handle the actual communication between instances.