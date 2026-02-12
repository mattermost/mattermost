// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebSocketEvents} from './websocket_events';
import type * as Messages from './websocket_messages';

export type WebSocketMessage = (
    Messages.Hello |
    Messages.AuthenticationChallenge |
    Messages.Response |

    Messages.Posted |
    Messages.PostEdited |
    Messages.PostDeleted |
    Messages.PostUnread |
    Messages.BurnOnReadPostRevealed |
    Messages.BurnOnReadPostBurned |
    Messages.BurnOnReadPostAllRevealed |
    Messages.EphemeralPost |
    Messages.PostReaction |
    Messages.PostAcknowledgement |
    Messages.PostDraft |
    Messages.PersistentNotificationTriggered |
    Messages.ScheduledPost |
    Messages.PostTranslationUpdated |

    Messages.ThreadUpdated |
    Messages.ThreadFollowedChanged |
    Messages.ThreadReadChanged |

    Messages.ChannelCreated |
    Messages.ChannelUpdated |
    Messages.ChannelConverted |
    Messages.ChannelSchemeUpdated |
    Messages.ChannelDeleted |
    Messages.ChannelRestored |
    Messages.DirectChannelCreated |
    Messages.GroupChannelCreated |
    Messages.UserAddedToChannel |
    Messages.UserRemovedFromChannel |
    Messages.ChannelMemberUpdated |
    Messages.MultipleChannelsViewed |

    Messages.ChannelBookmarkCreated |
    Messages.ChannelBookmarkUpdated |
    Messages.ChannelBookmarkDeleted |
    Messages.ChannelBookmarkSorted |

    Messages.Team |
    Messages.UpdateTeamScheme |
    Messages.UserAddedToTeam |
    Messages.UserRemovedFromTeam |
    Messages.TeamMemberRoleUpdated |

    Messages.NewUser |
    Messages.UserUpdated |
    Messages.UserActivationStatusChanged |
    Messages.UserRoleUpdated |
    Messages.StatusChanged |
    Messages.Typing |

    Messages.ReceivedGroup |
    Messages.GroupAssociatedToTeam |
    Messages.GroupAssociatedToChannel |
    Messages.GroupMember |

    Messages.PreferenceChanged |
    Messages.PreferencesChanged |

    Messages.SidebarCategoryCreated |
    Messages.SidebarCategoryUpdated |
    Messages.SidebarCategoryDeleted |
    Messages.SidebarCategoryOrderUpdated |

    Messages.EmojiAdded |

    Messages.RoleUpdated |

    Messages.ConfigChanged |
    Messages.GuestsDeactivated |
    Messages.LicenseChanged |
    Messages.CloudSubscriptionChanged |
    Messages.FirstAdminVisitMarketplaceStatusReceived |
    Messages.HostedCustomerSignupProgressUpdated |

    Messages.CPAFieldCreated |
    Messages.CPAFieldUpdated |
    Messages.CPAFieldDeleted |
    Messages.CPAValuesUpdated |

    Messages.ContentFlaggingReportValueUpdated |

    Messages.RecapUpdated |

    Messages.Plugin |
    Messages.PluginStatusesChanged |
    Messages.OpenDialog |

    BaseWebSocketMessage<WebSocketEvents.PresenceIndicator, unknown> |
    BaseWebSocketMessage<WebSocketEvents.PostedNotifyAck, unknown>
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type JsonEncodedValue<T> = string;

export type BaseWebSocketMessage<Event, T = Record<string, never>> = {
    event: Event;
    data: T;
    broadcast: WebSocketBroadcast;
    seq: number;
}

export type WebSocketBroadcast = {
    omit_users: Record<string, boolean>;
    user_id: string;
    channel_id: string;
    team_id: string;
}
