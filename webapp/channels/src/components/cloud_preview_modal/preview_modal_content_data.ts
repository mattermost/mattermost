// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PreviewModalContentData = {
    skuLabel: string;
    title: string;
    subtitle: string;
    videoUrl: string;
    useCase: string;
};

export const modalContent: PreviewModalContentData[] = [
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Welcome to your Mattermost preview',
        subtitle: 'This hands-on, 1-hour preview of Mattermost Enterprise Advanced lets your team explore secure, mission-critical collaboration. The workspace is preloaded with data to show the platform in action. Watch the 4-minute video to get started.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/Mattermost_TMM_Demo_Mission+Ops_20250307.mp4',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Messaging built for action, not noise',
        subtitle: 'Bring conversations and context together in one secure platform. Communicate with urgency using priority levels, persistent notifications, and  acknowledgments—so critical messages are seen and acted on when every second counts.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/priority-messages.jpg',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Bring your own AI model with Mattermost Agents',
        subtitle: 'Supercharge collaboration with Agents. Instantly summarize calls, surface action items, and find answers fast—all using the model you trust.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/ai-search.jpg',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Tailor user profiles to match your team\'s structure',
        subtitle: 'Create tailored user profiles with custom attributes like role, location, or clearance level to reflect your organization\'s structure. Help teams understand who they\'re working with and how to collaborate more effectively.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/custom-profile-attributes.jpg',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Build smart Playbooks for advanced workflows',
        subtitle: 'Unlock powerful workflows tailored to real-world complexity. When conditions change, define tasks for the Playbook to evolve with your dynamic processes.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/playbook-properties.jpg',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Flag sensitive content before it spreads',
        subtitle: 'Prevent accidental exposure by giving anyone the power to flag risky messages. Flagged content is instantly hidden and routed to security teams for review—helping you contain data leaks in real time.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/flag-messages.jpg',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Enforce Zero Trust collaboration',
        subtitle: 'Define granular access to content using attribute-based policies, and display classification banners and labels to guide user behavior. Limit exposure based on role, clearance level, or operational context.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/missionops/modal-assets/zero-trust.jpg',
        useCase: 'missionops',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Welcome to your Mattermost preview',
        subtitle: 'This hands-on, 1-hour preview of Mattermost Enterprise Advanced lets your DevSecOps team explore secure, collaborative development. The workspace is preloaded with data to show the platform in action. Watch the 4-minute video to get started.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/Mattermost_TMM_Demo_DevSecOps_20260610.mp4',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Messaging built for action, not noise',
        subtitle: 'Bring conversations and context together in one secure platform. Communicate with urgency using priority levels, persistent notifications, and acknowledgments—so critical messages are seen and acted on when every second counts.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/priority-messages.jpg',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Bring your own AI model with Mattermost Agents',
        subtitle: 'Supercharge collaboration with Agents. Instantly summarize calls, surface action items, and find answers fast—all using the model you trust.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/ai-search.jpg',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Tailor user profiles to match your team\'s structure',
        subtitle: 'Create tailored user profiles with custom attributes like role, location, or clearance level to reflect your organization\'s structure. Help teams understand who they\'re working with and how to collaborate more effectively.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/custom-profile-attributes.jpg',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Build smart Playbooks for advanced workflows',
        subtitle: 'Unlock powerful workflows tailored to real-world complexity. When conditions change, define tasks for the Playbook to evolve with your dynamic processes.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/playbook-properties.jpg',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Flag sensitive content before it spreads',
        subtitle: 'Prevent accidental exposure by giving anyone the power to flag risky messages. Flagged content is instantly hidden and routed to security teams for review—helping you contain data leaks in real time.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/flag-messages.jpg',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Enforce Zero Trust collaboration',
        subtitle: 'Define granular access to content using attribute-based policies, and display classification banners and labels to guide user behavior. Limit exposure based on role, clearance level, or operational context.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/devsecops/modal-assets/zero-trust.jpg',
        useCase: 'devsecops',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Welcome to your Mattermost preview',
        subtitle: 'This hands-on, 1-hour preview of Mattermost Enterprise Advanced lets your cyber defense team explore secure, threat-aware collaboration. The workspace is preloaded with data to show the platform in action. Watch the 4-minute video to get started.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/Mattermost_TMM_Demo_Cyber_Defense_20250417.mp4',
        useCase: 'cyberdefense',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Messaging built for action, not noise',
        subtitle: 'Bring conversations and context together in one secure platform. Communicate with urgency using priority levels, persistent notifications, and acknowledgments—so critical messages are seen and acted on when every second counts.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/priority-messages.jpg',
        useCase: 'cyberdefense',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Bring your own AI model with Mattermost Agents',
        subtitle: 'Supercharge collaboration with Agents. Instantly summarize calls, surface action items, and find answers fast—all using the model you trust.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/ai-search.jpg',
        useCase: 'cyberdefense',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Tailor user profiles to match your team\'s structure',
        subtitle: 'Create tailored user profiles with custom attributes like role, location, or clearance level to reflect your organization\'s structure. Help teams understand who they\'re working with and how to collaborate more effectively.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/custom-profile-attributes.jpg',
        useCase: 'cyberdefense',
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Build smart Playbooks for advanced workflows',
        subtitle: 'Unlock powerful workflows tailored to real-world complexity. When conditions change, define tasks for the Playbook to evolve with your dynamic processes.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/playbook-properties.jpg',
        useCase: 'cyberdefense',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Flag sensitive content before it spreads',
        subtitle: 'Prevent accidental exposure by giving anyone the power to flag risky messages. Flagged content is instantly hidden and routed to security teams for review—helping you contain data leaks in real time.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/flag-messages.jpg',
        useCase: 'cyberdefense',
    },
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Enforce Zero Trust collaboration',
        subtitle: 'Define granular access to content using attribute-based policies, and display classification banners and labels to guide user behavior. Limit exposure based on role, clearance level, or operational context.',
        videoUrl: 'https://mattermost-cloud-preview-assets.s3.us-east-2.amazonaws.com/cyberdefense/modal-assets/zero-trust.jpg',
        useCase: 'cyberdefense',
    },
];
