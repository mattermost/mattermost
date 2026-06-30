// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Deep, broad interactive payloads for translation benchmarks and complex snapshot tests. */

export const MM_BLOCKS_COMPLEX = [
    {
        type: 'text',
        text: '# Operations dashboard',
        size: 'medium',
    },
    {
        type: 'container',
        border: true,
        accent_color: 'primary',
        flow: 'vertical',
        gap: 'large',
        background: 'gray',
        max_height: 'medium',
        content: [
            {type: 'text', text: '**Fleet status** across regions', is_subtle: false},
            {type: 'divider'},
            {
                type: 'container',
                border: true,
                accent_color: 'good',
                flow: 'vertical',
                gap: 'medium',
                content: [
                    {type: 'text', text: 'Nested metrics panel', is_subtle: true, size: 'small'},
                    {
                        type: 'column_set',
                        gap: 'medium',
                        columns: [
                            {
                                type: 'column',
                                width: 'stretch',
                                gap: 'small',
                                items: [
                                    {type: 'text', text: '*North America*'},
                                    {type: 'text', text: 'Healthy: 42', size: 'small'},
                                    {type: 'text', text: 'Degraded: 2', size: 'small', is_subtle: true},
                                ],
                            },
                            {
                                type: 'column',
                                width: 'stretch',
                                gap: 'small',
                                items: [
                                    {type: 'text', text: '*Europe*'},
                                    {type: 'text', text: 'Healthy: 37', size: 'small'},
                                    {type: 'text', text: 'Degraded: 5', size: 'small', is_subtle: true},
                                ],
                            },
                            {
                                type: 'column',
                                width: 'auto',
                                items: [
                                    {
                                        type: 'image',
                                        url: 'https://example.com/heatmap.png',
                                        alt_text: 'Regional heatmap',
                                        title: 'Heatmap',
                                        size: 'small',
                                        max_width: 120,
                                        max_height: 80,
                                        horizontal_alignment: 'center',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                type: 'column_set',
                columns: [
                    {
                        type: 'column',
                        width: 'stretch',
                        items: [
                            {
                                type: 'collapsible',
                                collapsed: true,
                                header: [{type: 'text', text: 'Incident queue (4)'}],
                                content: [
                                    {
                                        type: 'container',
                                        flow: 'vertical',
                                        gap: 'small',
                                        content: [
                                            {type: 'text', text: 'INC-4412: API latency spike'},
                                            {type: 'text', text: 'INC-4410: Replica lag', is_subtle: true, size: 'small'},
                                            {
                                                type: 'button',
                                                text: 'Open runbook',
                                                action_id: 'open_runbook',
                                                style: 'primary',
                                                tooltip: 'View remediation steps',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'column',
                        width: 'stretch',
                        items: [
                            {
                                type: 'collapsible',
                                collapsed: false,
                                header: [{type: 'text', text: 'Deploy pipeline'}],
                                content: [
                                    {
                                        type: 'column_set',
                                        columns: [
                                            {
                                                type: 'column',
                                                width: 'stretch',
                                                items: [{type: 'text', text: 'Staging: green'}],
                                            },
                                            {
                                                type: 'column',
                                                width: 'stretch',
                                                items: [{type: 'text', text: 'Prod: yellow'}],
                                            },
                                        ],
                                    },
                                    {type: 'divider'},
                                    {
                                        type: 'button',
                                        text: 'Rollback',
                                        action_id: 'rollback_prod',
                                        style: 'danger',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        type: 'column_set',
        columns: [
            {
                type: 'column',
                width: 'stretch',
                items: [
                    {
                        type: 'static_select',
                        action_id: 'mm_env_select',
                        placeholder: 'Environment',
                        options: [
                            {text: 'Development', value: 'dev'},
                            {text: 'Staging', value: 'staging'},
                            {text: 'Production', value: 'prod'},
                            {text: 'Disaster recovery', value: 'dr'},
                        ],
                        initial_option: 'staging',
                    },
                ],
            },
            {
                type: 'column',
                width: 'stretch',
                items: [
                    {
                        type: 'static_select',
                        action_id: 'mm_team_select',
                        placeholder: 'Owning team',
                        options: [
                            {text: 'Platform', value: 'platform'},
                            {text: 'Mobile', value: 'mobile'},
                            {text: 'SRE', value: 'sre'},
                        ],
                        initial_option: 'sre',
                    },
                ],
            },
            {
                type: 'column',
                width: 'auto',
                items: [
                    {
                        type: 'button',
                        text: 'Acknowledge all',
                        action_id: 'ack_all',
                        style: 'primary',
                    },
                    {
                        type: 'button',
                        text: 'Silence 1h',
                        action_id: 'silence_1h',
                        style: 'default',
                    },
                ],
            },
        ],
    },
    {
        type: 'image',
        url: 'https://example.com/timeline.png',
        alt_text: 'Incident timeline',
        size: 'large',
        horizontal_alignment: 'left',
    },
] as const;

export const ATTACHMENTS_SIMPLE = [
    {
        color: '#36a64f',
        pretext: 'Optional pretext',
        author_name: 'Bot Author',
        title: 'Attachment title',
        title_link: 'https://example.com',
        text: 'Body *markdown* text',
    },
] as const;

export const ATTACHMENTS_COMPLEX = [
    {
        color: '#2d81ff',
        pretext: 'PagerDuty triggered for *production API* cluster',
        author_name: 'Incident Bot',
        author_link: 'https://example.com/author',
        author_icon: 'https://example.com/author.png',
        title: 'INC-9042: Elevated 5xx rate',
        title_link: 'https://example.com/report/9042',
        text: 'Error budget burn is **12%** over the last hour. Customer-facing latency p95 exceeded 2.4s.',
        fields: [
            {title: 'Severity', value: 'SEV-1', short: true},
            {title: 'Region', value: 'us-east-1', short: true},
            {title: 'Started', value: '2026-06-11 08:14 UTC', short: true},
            {title: 'Duration', value: '37 minutes', short: true},
            {title: 'Impacted services', value: 'API gateway, auth, search indexer', short: false},
            {title: 'Current hypothesis', value: 'Connection pool exhaustion on read replicas after cache stampede', short: false},
            {title: 'Customer impact', value: 'Delayed message delivery for ~4% of active sessions', short: false},
            {title: 'Next update', value: 'In 15 minutes or on status change', short: true},
            {title: 'Commander', value: '@sre-oncall', short: true},
            {title: '', value: 'skipped empty title'},
            {title: 'Empty value', value: null},
        ],
        image_url: 'https://example.com/error-rate-chart.png',
        thumb_url: 'https://example.com/thumb.png',
        footer: 'Generated by incident automation',
        footer_icon: 'https://example.com/footer.png',
        actions: [
            {name: 'Acknowledge', id: 'ack', style: 'primary'},
            {name: 'Escalate', id: 'escalate', style: 'danger'},
            {
                type: 'select',
                id: 'assignee',
                name: 'Assign commander',
                options: [
                    {text: 'Alice Chen', value: 'alice'},
                    {text: 'Bob Patel', value: 'bob'},
                    {text: 'Carla Ruiz', value: 'carla'},
                    {text: 'Dana Kim', value: 'dana'},
                ],
                default_option: 'alice',
            },
            {
                type: 'select',
                id: 'severity',
                name: 'Severity',
                options: [
                    {text: 'SEV-1', value: '1'},
                    {text: 'SEV-2', value: '2'},
                    {text: 'SEV-3', value: '3'},
                ],
                default_option: '1',
            },
            {type: 'select', id: 'users', name: 'Page user', data_source: 'users'},
            {type: 'select', id: 'channels', name: 'War room', data_source: 'channels'},
        ],
    },
    {
        color: '#f2c744',
        pretext: 'Follow-up investigation thread',
        author_name: 'Metrics Explorer',
        author_icon: 'https://example.com/metrics.png',
        title: 'Replica lag correlation',
        text: 'Read replica lag climbed 8 minutes before the error spike. Cache miss ratio doubled during the same window.',
        fields: [
            {title: 'Replica set', value: 'rs-prod-read-3', short: true},
            {title: 'Max lag', value: '18.4s', short: true},
            {title: 'Cache hit ratio', value: '61% → 29%', short: true},
            {title: 'Top query', value: 'channel_members_by_ids', short: true},
            {title: 'Suggested action', value: 'Scale read pool + invalidate hot cache keys', short: false},
        ],
        thumb_url: 'https://example.com/replica-thumb.png',
        footer: 'Attached from Grafana dashboard',
        actions: [
            {name: 'Open dashboard', id: 'open_dashboard'},
            {name: 'Create ticket', id: 'create_ticket', style: 'primary'},
        ],
    },
    {
        title: 'Unsafe link title',
        // eslint-disable-next-line no-script-url
        title_link: 'javascript:alert(1)',
        text: 'Title link must not render when URL is unsafe',
    },
] as const;

export const BLOCK_KIT_SIMPLE = [
    {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: '*Hello* from Block Kit',
        },
    },
    {
        type: 'divider',
    },
    {
        type: 'actions',
        elements: [
            {
                type: 'button',
                text: {type: 'plain_text', text: 'OK'},
                action_id: 'block_kit_demo',
            },
        ],
    },
] as const;

export const BLOCK_KIT_COMPLEX = [
    {
        type: 'header',
        text: {type: 'plain_text', text: 'Release approval workflow'},
    },
    {
        type: 'section',
        text: {type: 'mrkdwn', text: '*Build 2.41.0-rc3* is ready for production. Review the checklist below before approving.'},
        accessory: {
            type: 'button',
            text: {type: 'plain_text', text: 'View build'},
            action_id: 'view_build',
            style: 'primary',
        },
    },
    {
        type: 'markdown',
        text: '### Validation summary\n- 1,284 unit tests passed\n- 42 e2e scenarios passed\n- 0 critical vulnerabilities',
    },
    {
        type: 'section',
        fields: [
            {type: 'mrkdwn', text: '*Commit*'},
            {type: 'mrkdwn', text: '`a91f3c2`'},
            {type: 'mrkdwn', text: '*Branch*'},
            {type: 'mrkdwn', text: '`release-2.41`'},
            {type: 'mrkdwn', text: '*Artifacts*'},
            {type: 'mrkdwn', text: 'iOS, Android, Desktop'},
            {type: 'mrkdwn', text: '*Risk score*'},
            {type: 'mrkdwn', text: 'Low (2 open defects)'},
            {type: 'mrkdwn', text: '*Canary status*'},
            {type: 'mrkdwn', text: 'Green for 6h'},
        ],
    },
    {
        type: 'divider',
    },
    {
        type: 'section',
        text: {type: 'mrkdwn', text: 'Deployment regions'},
        accessory: {
            type: 'image',
            image_url: 'https://example.com/world-map.png',
            alt_text: 'World map',
        },
    },
    {
        type: 'section',
        fields: [
            {type: 'mrkdwn', text: '*US*'},
            {type: 'mrkdwn', text: 'Ready'},
            {type: 'mrkdwn', text: '*EU*'},
            {type: 'mrkdwn', text: 'Ready'},
            {type: 'mrkdwn', text: '*APAC*'},
            {type: 'mrkdwn', text: 'Pending cache warm'},
        ],
    },
    {
        type: 'image',
        image_url: 'https://example.com/release-timeline.png',
        alt_text: 'Release timeline',
        title: {type: 'plain_text', text: 'Rollout timeline'},
    },
    {
        type: 'actions',
        elements: [
            {
                type: 'button',
                text: {type: 'plain_text', text: 'Approve'},
                action_id: 'approve_release',
                style: 'primary',
            },
            {
                type: 'button',
                text: {type: 'plain_text', text: 'Reject'},
                action_id: 'reject_release',
                style: 'danger',
            },
            {
                type: 'static_select',
                action_id: 'rollout_strategy',
                placeholder: {type: 'plain_text', text: 'Rollout strategy'},
                options: [
                    {text: {type: 'plain_text', text: 'Immediate'}, value: 'immediate'},
                    {text: {type: 'plain_text', text: '10% canary'}, value: 'canary_10'},
                    {text: {type: 'plain_text', text: '25% canary'}, value: 'canary_25'},
                    {text: {type: 'plain_text', text: 'Blue/green'}, value: 'blue_green'},
                ],
            },
        ],
    },
    {
        type: 'actions',
        elements: [
            {
                type: 'static_select',
                action_id: 'notify_channel',
                placeholder: {type: 'plain_text', text: 'Notify channel'},
                options: [
                    {text: {type: 'plain_text', text: '#releases'}, value: 'releases'},
                    {text: {type: 'plain_text', text: '#engineering'}, value: 'engineering'},
                    {text: {type: 'plain_text', text: '#support'}, value: 'support'},
                ],
            },
            {
                type: 'button',
                text: {type: 'plain_text', text: 'Schedule'},
                action_id: 'schedule_release',
            },
            {
                type: 'button',
                text: {type: 'plain_text', text: 'Cancel'},
                action_id: 'cancel_release',
            },
        ],
    },
] as const;

export const ADAPTIVE_CARDS_SIMPLE = [
    {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body: [
            {
                type: 'TextBlock',
                text: 'Hello from an Adaptive Card',
                wrap: true,
            },
        ],
    },
] as const;

export const ADAPTIVE_CARDS_COMPLEX = [
    {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body: [
            {
                type: 'TextBlock',
                text: 'Customer onboarding review',
                weight: 'Bolder',
                size: 'Medium',
            },
            {
                type: 'TextBlock',
                text: 'Account AC-91822 requested enterprise provisioning with SSO and SCIM.',
                wrap: true,
                isSubtle: true,
            },
            {
                type: 'Container',
                items: [
                    {
                        type: 'TextBlock',
                        text: 'Account details',
                        weight: 'Bolder',
                    },
                    {
                        type: 'ColumnSet',
                        columns: [
                            {
                                type: 'Column',
                                width: 'stretch',
                                items: [
                                    {type: 'TextBlock', text: 'Company: Northwind Labs', wrap: true},
                                    {type: 'TextBlock', text: 'Seats: 2,500', isSubtle: true, wrap: true},
                                    {type: 'TextBlock', text: 'Plan: Enterprise Plus', isSubtle: true, wrap: true},
                                ],
                            },
                            {
                                type: 'Column',
                                width: 'stretch',
                                items: [
                                    {type: 'TextBlock', text: 'Region: EU-West', wrap: true},
                                    {type: 'TextBlock', text: 'Data residency: Frankfurt', isSubtle: true, wrap: true},
                                    {type: 'TextBlock', text: 'SLA: 99.95%', isSubtle: true, wrap: true},
                                ],
                            },
                            {
                                type: 'Column',
                                width: 'auto',
                                items: [
                                    {
                                        type: 'Image',
                                        url: 'https://example.com/account-logo.png',
                                        altText: 'Account logo',
                                        size: 'Small',
                                        style: 'person',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                type: 'Container',
                items: [
                    {
                        type: 'TextBlock',
                        text: 'Provisioning checklist',
                        weight: 'Bolder',
                    },
                    {
                        type: 'ColumnSet',
                        columns: [
                            {
                                type: 'Column',
                                width: 'stretch',
                                items: [
                                    {
                                        type: 'Container',
                                        items: [
                                            {type: 'TextBlock', text: 'Identity', weight: 'Bolder'},
                                            {type: 'TextBlock', text: 'SAML metadata uploaded', wrap: true},
                                            {type: 'TextBlock', text: 'SCIM token issued', isSubtle: true, wrap: true},
                                        ],
                                    },
                                ],
                            },
                            {
                                type: 'Column',
                                width: 'stretch',
                                items: [
                                    {
                                        type: 'Container',
                                        items: [
                                            {type: 'TextBlock', text: 'Infrastructure', weight: 'Bolder'},
                                            {type: 'TextBlock', text: 'Dedicated namespace created', wrap: true},
                                            {type: 'TextBlock', text: 'Backup policy attached', isSubtle: true, wrap: true},
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'Image',
                        url: 'https://example.com/provisioning-diagram.png',
                        altText: 'Provisioning diagram',
                        size: 'Medium',
                        horizontalAlignment: 'Center',
                    },
                ],
            },
            {
                type: 'ActionSet',
                actions: [
                    {
                        type: 'Action.Submit',
                        title: 'Approve provisioning',
                        id: 'approve_provision',
                        style: 'positive',
                    },
                    {
                        type: 'Action.Submit',
                        title: 'Request changes',
                        id: 'request_changes',
                    },
                    {
                        type: 'Action.Submit',
                        title: 'Reject',
                        id: 'reject_provision',
                        style: 'destructive',
                    },
                ],
            },
        ],
        actions: [
            {
                type: 'Action.Submit',
                title: 'Assign reviewer',
                id: 'assign_reviewer',
            },
            {
                type: 'Action.Submit',
                title: 'Open CRM record',
                id: 'open_crm',
            },
        ],
    },
    {
        type: 'NotACard',
        body: [{type: 'TextBlock', text: 'Should be skipped'}],
    },
] as const;
