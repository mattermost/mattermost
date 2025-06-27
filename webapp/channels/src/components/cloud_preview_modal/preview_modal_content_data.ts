// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

export type PreviewModalContentData = {
    skuLabel: MessageDescriptor;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    videoUrl: string;
    videoPoster?: string;
    useCase: string;
};

export const modalContent: PreviewModalContentData[] = [
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.missionops.sku_label',
            defaultMessage: 'ENTERPRISE ADVANCED',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.missionops.welcome.title',
            defaultMessage: 'Welcome to your Mattermost preview',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.missionops.welcome.subtitle',
            defaultMessage: 'This hands-on, 1-hour preview of Mattermost Enterprise Advanced lets your team explore secure, mission-critical collaboration. The workspace is preloaded with data to show the platform in action. Watch the 4-minute video to get started.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/Mattermost_TMM_Demo_Mission+Ops_20250307.mp4',
        videoPoster: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/Mattermost_TMM_Demo_MissionOps_Poster.jpg',
        useCase: 'mission-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.missionops.messaging.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.missionops.messaging.title',
            defaultMessage: 'Messaging built for action, not noise',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.missionops.messaging.subtitle',
            defaultMessage: 'Bring conversations and context together in one secure platform. Communicate with urgency using priority levels, persistent notifications, and acknowledgments—so critical messages are seen and acted on when every second counts.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/priority-messages.jpg',
        useCase: 'mission-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.missionops.ai.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.missionops.ai.title',
            defaultMessage: 'Bring your own AI model with Mattermost Agents',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.missionops.ai.subtitle',
            defaultMessage: 'Supercharge collaboration with Agents. Instantly summarize calls, surface action items, and find answers fast—all using the model you trust.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/ai-search.jpg',
        useCase: 'mission-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.missionops.profiles.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.missionops.profiles.title',
            defaultMessage: 'Tailor user profiles to match your team\'s structure',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.missionops.profiles.subtitle',
            defaultMessage: 'Create tailored user profiles with custom attributes like role, location, or clearance level to reflect your organization\'s structure. Help teams understand who they\'re working with and how to collaborate more effectively.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/custom-profile-attributes.jpg',
        useCase: 'mission-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.missionops.playbooks.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.missionops.playbooks.title',
            defaultMessage: 'Build smart Playbooks for advanced workflows',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.missionops.playbooks.subtitle',
            defaultMessage: 'Move faster and make fewer mistakes with checklist-based automations that power your team’s workflows.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/playbook-properties.jpg',
        useCase: 'mission-ops',
    },

    // {
    //     skuLabel: defineMessage({
    //         id: 'cloud_preview_modal.missionops.flagging.sku_label',
    //         defaultMessage: 'ENTERPRISE ADVANCED',
    //     }),
    //     title: defineMessage({
    //         id: 'cloud_preview_modal.missionops.flagging.title',
    //         defaultMessage: 'Flag sensitive content before it spreads',
    //     }),
    //     subtitle: defineMessage({
    //         id: 'cloud_preview_modal.missionops.flagging.subtitle',
    //         defaultMessage: 'Prevent accidental exposure by giving anyone the power to flag risky messages. Flagged content is instantly hidden and routed to security teams for review—helping you contain data leaks in real time.',
    //     }),
    //     videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/flag-messages.jpg',
    //     useCase: 'missionops',
    // },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.missionops.zero_trust.sku_label',
            defaultMessage: 'ENTERPRISE ADVANCED',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.missionops.zero_trust.title',
            defaultMessage: 'Enforce Zero Trust collaboration',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.missionops.zero_trust.subtitle',
            defaultMessage: 'Define granular access to content using attribute-based policies, and display classification banners and labels to guide user behavior. Limit exposure based on role, clearance level, or operational context.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/zero-trust.jpg',
        useCase: 'mission-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.devsecops.sku_label',
            defaultMessage: 'ENTERPRISE ADVANCED',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.devsecops.welcome.title',
            defaultMessage: 'Welcome to your Mattermost preview',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.devsecops.welcome.subtitle',
            defaultMessage: 'This hands-on, 1-hour preview of Mattermost Enterprise Advanced lets your DevSecOps team explore secure, collaborative development. The workspace is preloaded with data to show the platform in action. Watch the 4-minute video to get started.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/Mattermost_TMM_Demo_DevSecOps_20260610.mp4',
        videoPoster: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/Mattermost_TMM_Demo_DevSecOps_Poster.jpg',
        useCase: 'dev-sec-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.devsecops.messaging.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.devsecops.messaging.title',
            defaultMessage: 'Messaging built for action, not noise',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.devsecops.messaging.subtitle',
            defaultMessage: 'Bring conversations and context together in one secure platform. Communicate with urgency using priority levels, persistent notifications, and acknowledgments—so critical messages are seen and acted on when every second counts.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/priority-messages.jpg',
        useCase: 'dev-sec-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.devsecops.ai.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.devsecops.ai.title',
            defaultMessage: 'Bring your own AI model with Mattermost Agents',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.devsecops.ai.subtitle',
            defaultMessage: 'Supercharge collaboration with Agents. Instantly summarize calls, surface action items, and find answers fast—all using the model you trust.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/ai-search.jpg',
        useCase: 'dev-sec-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.devsecops.profiles.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.devsecops.profiles.title',
            defaultMessage: 'Tailor user profiles to match your team\'s structure',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.devsecops.profiles.subtitle',
            defaultMessage: 'Create tailored user profiles with custom attributes like role, location, or clearance level to reflect your organization\'s structure. Help teams understand who they\'re working with and how to collaborate more effectively.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/custom-profile-attributes.jpg',
        useCase: 'dev-sec-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.devsecops.playbooks.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.devsecops.playbooks.title',
            defaultMessage: 'Build smart Playbooks for advanced workflows',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.devsecops.playbooks.subtitle',
            defaultMessage: 'Move faster and make fewer mistakes with checklist-based automations that power your team’s workflows.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/playbook-properties.jpg',
        useCase: 'dev-sec-ops',
    },

    // {
    //     skuLabel: defineMessage({
    //         id: 'cloud_preview_modal.devsecops.flagging.sku_label',
    //         defaultMessage: 'ENTERPRISE ADVANCED',
    //     }),
    //     title: defineMessage({
    //         id: 'cloud_preview_modal.devsecops.flagging.title',
    //         defaultMessage: 'Flag sensitive content before it spreads',
    //     }),
    //     subtitle: defineMessage({
    //         id: 'cloud_preview_modal.devsecops.flagging.subtitle',
    //         defaultMessage: 'Prevent accidental exposure by giving anyone the power to flag risky messages. Flagged content is instantly hidden and routed to security teams for review—helping you contain data leaks in real time.',
    //     }),
    //     videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/flag-messages.jpg',
    //     useCase: 'devsecops',
    // },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.devsecops.zero_trust.sku_label',
            defaultMessage: 'ENTERPRISE ADVANCED',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.devsecops.zero_trust.title',
            defaultMessage: 'Enforce Zero Trust collaboration',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.devsecops.zero_trust.subtitle',
            defaultMessage: 'Define granular access to content using attribute-based policies, and display classification banners and labels to guide user behavior. Limit exposure based on role, clearance level, or operational context.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/zero-trust.jpg',
        useCase: 'dev-sec-ops',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.sku_label',
            defaultMessage: 'ENTERPRISE ADVANCED',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.welcome.title',
            defaultMessage: 'Welcome to your Mattermost preview',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.welcome.subtitle',
            defaultMessage: 'This hands-on, 1-hour preview of Mattermost Enterprise Advanced lets your cyber defense team explore secure, threat-aware collaboration. The workspace is preloaded with data to show the platform in action. Watch the 4-minute video to get started.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/Mattermost_TMM_Demo_Cyber_Defense_20250417.mp4',
        videoPoster: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/Mattermost_TMM_Demo_Cyber_Defense_Poster.jpg',
        useCase: 'cyber-defense',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.messaging.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.messaging.title',
            defaultMessage: 'Messaging built for action, not noise',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.messaging.subtitle',
            defaultMessage: 'Bring conversations and context together in one secure platform. Communicate with urgency using priority levels, persistent notifications, and acknowledgments—so critical messages are seen and acted on when every second counts.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/priority-messages.jpg',
        useCase: 'cyber-defense',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.ai.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.ai.title',
            defaultMessage: 'Bring your own AI model with Mattermost Agents',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.ai.subtitle',
            defaultMessage: 'Supercharge collaboration with Agents. Instantly summarize calls, surface action items, and find answers fast—all using the model you trust.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/ai-search.jpg',
        useCase: 'cyber-defense',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.profiles.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.profiles.title',
            defaultMessage: 'Tailor user profiles to match your team\'s structure',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.profiles.subtitle',
            defaultMessage: 'Create tailored user profiles with custom attributes like role, location, or clearance level to reflect your organization\'s structure. Help teams understand who they\'re working with and how to collaborate more effectively.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/custom-profile-attributes.jpg',
        useCase: 'cyber-defense',
    },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.playbooks.sku_label',
            defaultMessage: 'ENTERPRISE',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.playbooks.title',
            defaultMessage: 'Build smart Playbooks for advanced workflows',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.playbooks.subtitle',
            defaultMessage: 'Move faster and make fewer mistakes with checklist-based automations that power your team’s workflows.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/playbook-properties.jpg',
        useCase: 'cyber-defense',
    },

    // {
    //     skuLabel: defineMessage({
    //         id: 'cloud_preview_modal.cyberdefense.flagging.sku_label',
    //         defaultMessage: 'ENTERPRISE ADVANCED',
    //     }),
    //     title: defineMessage({
    //         id: 'cloud_preview_modal.cyberdefense.flagging.title',
    //         defaultMessage: 'Flag sensitive content before it spreads',
    //     }),
    //     subtitle: defineMessage({
    //         id: 'cloud_preview_modal.cyberdefense.flagging.subtitle',
    //         defaultMessage: 'Prevent accidental exposure by giving anyone the power to flag risky messages. Flagged content is instantly hidden and routed to security teams for review—helping you contain data leaks in real time.',
    //     }),
    //     videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/flag-messages.jpg',
    //     useCase: 'cyberdefense',
    // },
    {
        skuLabel: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.zero_trust.sku_label',
            defaultMessage: 'ENTERPRISE ADVANCED',
        }),
        title: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.zero_trust.title',
            defaultMessage: 'Enforce Zero Trust collaboration',
        }),
        subtitle: defineMessage({
            id: 'cloud_preview_modal.cyberdefense.zero_trust.subtitle',
            defaultMessage: 'Define granular access to content using attribute-based policies, and display classification banners and labels to guide user behavior. Limit exposure based on role, clearance level, or operational context.',
        }),
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/zero-trust.jpg',
        useCase: 'cyber-defense',
    },
];
