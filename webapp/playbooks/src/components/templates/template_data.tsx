// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';

import {mtrim} from 'js-trim-multiline-string';

import {DraftPlaybookWithChecklist, emptyPlaybook, newChecklistItem} from 'src/types/playbook';

import MattermostLogo from 'src/components/assets/mattermost_logo_svg';
import ClipboardChecklist from 'src/components/assets/illustrations/clipboard_checklist_svg';
import DumpsterFire from 'src/components/assets/illustrations/dumpster_fire_svg';
import Gears from 'src/components/assets/illustrations/gears_svg';
import Handshake from 'src/components/assets/illustrations/handshake_svg';
import Rocket from 'src/components/assets/illustrations/rocket_svg';
import SmileySunglasses from 'src/components/assets/illustrations/smiley_sunglasses_svg';
import BugSearch from 'src/components/assets/illustrations/bug_search_svg';
import LightBulb from 'src/components/assets/illustrations/light_bulb_svg';

export interface PresetTemplate {
    label?: string;
    labelColor?: string;
    title: string;
    description?: string;

    author?: ReactNode;
    icon: ReactNode;
    color?: string;
    template: DraftPlaybookWithChecklist;
}

const preprocessTemplates = (presetTemplates: PresetTemplate[]): PresetTemplate[] => (
    presetTemplates.map((pt) => ({
        ...pt,
        template: {
            ...pt.template,
            num_stages: pt.template?.checklists.length,
            num_actions:
                1 + // Channel creation is hard-coded
                (pt.template.message_on_join_enabled ? 1 : 0) +
                (pt.template.signal_any_keywords_enabled ? 1 : 0) +
                (pt.template.run_summary_template_enabled ? 1 : 0),
            checklists: pt.template?.checklists.map((checklist) => ({
                ...checklist,
                items: checklist.items?.map((item) => ({
                    ...newChecklistItem(),
                    ...item,
                })) || [],
            })),
        },
    }))
);

export const PresetTemplates: PresetTemplate[] = preprocessTemplates([
    {
        title: 'Blank',
        icon: <ClipboardChecklist/>,
        color: '#FFBC1F14',
        description: 'Start with a blank state and create your own masterpiece.',
        template: {
            ...emptyPlaybook(),
            title: 'Blank',
            description: 'Customize this playbook\'s description to give an overview of when and how this playbook is run.',
        },
    },
    {
        title: 'Product Release',
        description: 'Perfect your release process from ideation to production.',
        icon: <Rocket/>,
        color: '#C4313314',
        author: <MattermostLogo/>,
        template: {
            ...emptyPlaybook(),
            title: 'Product Release',
            description: 'Customize this playbook to reflect your own product release process.',
            checklists: [
                {
                    title: 'Prepare code',
                    items: [
                        newChecklistItem('Triage and check for pending tickets and PRs to merge'),
                        newChecklistItem('Start drafting changelog, feature documentation, and marketing materials'),
                        newChecklistItem('Review and update project dependencies as needed'),
                        newChecklistItem('QA prepares release testing assignments'),
                        newChecklistItem('Merge database upgrade'),
                    ],
                },
                {
                    title: 'Release testing',
                    items: [
                        newChecklistItem('Cut a Release Candidate (RC-1)'),
                        newChecklistItem('QA runs smoke tests on the pre-release build'),
                        newChecklistItem('QA runs automated load tests and upgrade tests on the pre-release build'),
                        newChecklistItem('Triage and merge regression bug fixes'),
                    ],
                },
                {
                    title: 'Prepare release for production',
                    items: [
                        newChecklistItem('QA final approves the release'),
                        newChecklistItem('Cut the final release build and publish'),
                        newChecklistItem('Deploy changelog, upgrade notes, and feature documentation'),
                        newChecklistItem('Confirm minimum server requirements are updated in documentation'),
                        newChecklistItem('Update release download links in relevant docs and webpages'),
                        newChecklistItem('Publish announcements and marketing'),
                    ],
                },
                {
                    title: 'Post-release',
                    items: [
                        newChecklistItem('Schedule a release retrospective'),
                        newChecklistItem('Add dates for the next release to the release calendar and communicate to stakeholders'),
                        newChecklistItem('Compose release metrics'),
                        newChecklistItem('Prepare security update communications'),
                        newChecklistItem('Archive the incident channel and create a new one for the next release'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            channel_name_template: 'Release (vX.Y)',
            message_on_join_enabled: true,
            message_on_join:
                mtrim`Hello and welcome!

                This channel was created as part of the **Product Release** playbook and is where conversations related to this release are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.`,
            run_summary_template_enabled: true,
            run_summary_template:
                mtrim`**About**
                - Version number: TBD
                - Target-date: TBD

                **Resources**
                - Jira filtered view: [link TBD](#)
                - Blog post draft: [link TBD](#)`,
            reminder_message_template:
                mtrim`### Changes since last update
                -

                ### Outstanding PRs
                - `,
            reminder_timer_default_seconds: 24 * 60 * 60, // 24 hours
            retrospective_template:
                mtrim`### Start
                -

                ### Stop
                -

                ### Keep
                - `,
            retrospective_reminder_interval_seconds: 0, // Once
        },
    },
    {
        title: 'Incident Resolution',
        description: 'Resolving incidents requires speed and accuracy. Streamline your processes for rapid response and resolution.',
        icon: <DumpsterFire/>,
        author: <MattermostLogo/>,
        color: '#33997014',
        template: {
            ...emptyPlaybook(),
            title: 'Incident Resolution',
            description: 'Customize this playbook to reflect your own incident resolution process.',
            checklists: [
                {
                    title: 'Setup for triage',
                    items: [
                        newChecklistItem('Add on-call engineer to channel'),
                        newChecklistItem('Start bridge call', '', '/zoom start'),
                        newChecklistItem('Update description with current situation'),
                        newChecklistItem('Create an incident ticket', '', '/jira create'),
                        newChecklistItem('Assign severity in description (ie. #sev-2)'),
                        newChecklistItem('(If #sev-1) Notify @vip'),
                    ],
                },
                {
                    title: 'Investigate cause',
                    items: [
                        newChecklistItem('Add suspected causes here and check off if eliminated'),
                    ],
                },
                {
                    title: 'Resolution',
                    items: [
                        newChecklistItem('Confirm issue has been resolved'),
                        newChecklistItem('Notify customer success managers'),
                        newChecklistItem('(If sev-1) Notify leader team'),
                    ],
                },
                {
                    title: 'Retrospective',
                    items: [
                        newChecklistItem('Send out survey to participants'),
                        newChecklistItem('Schedule post-mortem meeting'),
                        newChecklistItem('Save key messages as timeline entries'),
                        newChecklistItem('Publish retrospective report'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            channel_name_template: 'Incident: <name>',
            message_on_join_enabled: true,
            message_on_join:
                mtrim`Hello and welcome!

                This channel was created as part of the **Incident Resolution** playbook and is where conversations related to this release are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.`,
            run_summary_template_enabled: true,
            run_summary_template:
                mtrim`**Summary**

                **Customer impact**

                **About**
                - Severity: #sev-1/2/3
                - Responders:
                - ETA to resolution:`,
            reminder_message_template: '',
            reminder_timer_default_seconds: 60 * 60, // 1 hour
            retrospective_template:
                mtrim`### Summary
                This should contain 2-3 sentences that give a reader an overview of what happened, what was the cause, and what was done. The briefer the better as this is what future teams will look at first for reference.

                ### What was the impact?
                This section describes the impact of this playbook run as experienced by internal and external customers as well as stakeholders.

                ### What were the contributing factors?
                This playbook may be a reactive protocol to a situation that is otherwise undesirable. If that's the case, this section explains the reasons that caused the situation in the first place. There may be multiple root causes - this helps stakeholders understand why.

                ### What was done?
                This section tells the story of how the team collaborated throughout the event to achieve the outcome. This will help future teams learn from this experience on what they could try.

                ### What did we learn?
                This section should include perspective from everyone that was involved to celebrate the victories and identify areas for improvement. For example: What went well? What didn't go well? What should be done differently next time?

                ### Follow-up tasks
                This section lists the action items to turn learnings into changes that help the team become more proficient with iterations. It could include tweaking the playbook, publishing the retrospective, or other improvements. The best follow-ups will have a clear owner assigned as well as due date.

                ### Timeline highlights
                This section is a curated log that details the most important moments. It can contain key communications, screen shots, or other artifacts. Use the built-in timeline feature to help you retrace and replay the sequence of events.`,
            retrospective_reminder_interval_seconds: 24 * 60 * 60, // 24 hours
            signal_any_keywords_enabled: true,
            signal_any_keywords: ['sev-1', 'sev-2', '#incident', 'this is serious'],
        },
    },
    {
        title: 'Customer Onboarding',
        description: 'Create a standardized, smooth onboarding experience for new customers to get them up and running quickly. ',
        icon: <Handshake/>,
        color: '#3C507A14',
        author: <MattermostLogo/>,
        template: {
            ...emptyPlaybook(),
            title: 'Customer Onboarding',
            description: mtrim`New Mattermost customers are onboarded following a process similar to this playbook.

            Customize this playbook to reflect your own customer onboarding process.`,
            checklists: [
                {
                    title: 'Sales to Post-Sales Handoff',
                    items: [
                        newChecklistItem('AE intro CSM and CSE to key contacts'),
                        newChecklistItem('Create customer account Drive folder'),
                        newChecklistItem('Welcome email within 24hr of Closed Won'),
                        newChecklistItem('Schedule initial kickoff call with customer'),
                        newChecklistItem('Create account plan (Tier 1 or 2)'),
                        newChecklistItem('Send discovery Survey'),
                    ],
                },
                {
                    title: 'Customer Technical Onboarding',
                    items: [
                        newChecklistItem('Schedule technical discovery call'),
                        newChecklistItem('Review current Zendesk tickets and updates'),
                        newChecklistItem('Log customer technical details in Salesforce'),
                        newChecklistItem('Confirm customer received technical discovery summary package'),
                        newChecklistItem('Send current Mattermost “Pen Test” report to customer'),
                        newChecklistItem('Schedule plugin/integration planning session'),
                        newChecklistItem('Confirm data migration plans'),
                        newChecklistItem('Extend Mattermost with integrations'),
                        newChecklistItem('Confirm functional & load test plans'),
                        newChecklistItem('Confirm team/channel organization'),
                        newChecklistItem('Sign up for Mattermost blog for releases and announcements'),
                        newChecklistItem('Confirm next upgrade version'),
                    ],
                },
                {
                    title: 'Go-Live',
                    items: [
                        newChecklistItem('Order Mattermost swag package for project team'),
                        newChecklistItem('Confirm end-user roll-out plan'),
                        newChecklistItem('Confirm customer go-live'),
                        newChecklistItem('Perform post go-live retrospective'),
                    ],
                },
                {
                    title: 'Optional value prompts after go-live',
                    items: [
                        newChecklistItem('Intro playbooks and boards'),
                        newChecklistItem('Inform upgrading Mattermost 101'),
                        newChecklistItem('Share tips & tricks w/ DevOps focus'),
                        newChecklistItem('Share tips & tricks w/ efficiency focus'),
                        newChecklistItem('Schedule quarterly roadmap review w/ product team'),
                        newChecklistItem('Review with executives (Tier 1 or 2)'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            channel_name_template: 'Customer Onboarding: <name>',
            message_on_join_enabled: true,
            message_on_join:
                mtrim`Hello and welcome!

                This channel was created as part of the **Customer Onboarding** playbook and is where conversations related to this customer are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.`,
            run_summary_template_enabled: true,
            run_summary_template:
                mtrim`**About**
                - Account name: [TBD](#)
                - Salesforce opportunity: [TBD](#)
                - Order type:
                - Close date:

                **Team**
                - Sales Rep: @TBD
                - Customer Success Manager: @TBD`,
            retrospective_template:
                mtrim`### What went well?
                -

                ### What could have gone better?
                -

                ### What should be changed for next time?
                - `,
            retrospective_reminder_interval_seconds: 0, // Once
        },
    },
    {
        title: 'Employee Onboarding',
        description: 'Set your new hires up for success with input from your entire organization, in one smooth process.',
        icon: <SmileySunglasses/>,
        color: '#FFBC1F14',
        author: <MattermostLogo/>,
        template: {
            ...emptyPlaybook(),
            title: 'Employee Onboarding',
            description: mtrim`Every new Mattermost Staff member completes this onboarding process when joining the company.

            Customize this playbook to reflect your own employee onboarding process.`,
            checklists: [
                {
                    title: 'Pre-day one',
                    items: [
                        newChecklistItem('Complete the [Onboarding Systems Form in the IT HelpDesk](https://helpdesk.mattermost.com/support/home)'),
                        newChecklistItem(
                            'Complete the onboarding template prior to your new staff member\'s start date',
                            mtrim`Managers play a large role in setting their new direct report up for success and making them feel welcome by setting clear expectations and preparing the team and internal stakeholders for how they can help new colleagues integrate and connect organizationally and culturally.
                                * **Onboarding Objectives:** Clarify the areas and projects your new team member should focus on in their first 90 days. Use the _Overview of the Role_ that you completed when you opened the role.
                                * **AOR clarity:** Identify AORs that are relevant for your new hire, and indicate any AORs that your new hire will [DRI](https://handbook.mattermost.com/company/about-mattermost/list-of-terms#dri) or act as backup DRI. As needed, clarify AOR transitions with internal stakeholders ahead of your new hire's start date. See [AOR page](https://handbook.mattermost.com/operations/operations/areas-of-responsibility) Include the interview panel and their respective focus areas.
                                * **Assign an Onboarding Peer:** The Onboarding Peer or peers should be an individual or group of people that can help answer questions about the team, department and Mattermost. In many ways, an Onboarding Peer may be an [end-boss](https://handbook.mattermost.com/company/about-mattermost/mindsets#mini-boss-end-boss) for specific AORs. Managers should ask permission of a potential Onboarding Peer prior to assignment.`,
                        ),
                    ],
                },
                {
                    title: 'Week one',
                    items: [
                        newChecklistItem(
                            'Introduce our new staff member in the [Welcome Channel](https://community.mattermost.com/private-core/channels/welcome)',
                            mtrim`All new hires are asked to complete a short bio and share with their Managers. Managers should include this bio in the welcome message.

                                Be sure to include the hashtag \#newcolleague when posting your message.`,
                        ),
                        newChecklistItem(
                            'Review Team [AORs](https://handbook.mattermost.com/operations/operations/areas-of-responsibility)',
                            'This is also a good time to review the new hire\'s AOR and onboarding expectations.'
                        ),
                        newChecklistItem(
                            'Review list of key internal partners',
                            'These are individuals the new staff member will work with and who the new staff member should set up meetings with during their first month or two.',
                        ),
                        newChecklistItem(
                            'Add to Mattermost channels',
                            'Ensure your team member is added to appropriate channels based on team and role.',
                        ),
                        newChecklistItem(
                            'Share team cadences',
                            'Review specific team cadences, operating norms and relevant playbooks.',
                        ),
                    ],
                },
                {
                    title: 'Month one',
                    items: [
                        newChecklistItem('Review Company and Team [V2MOMs](https://handbook.mattermost.com/company/how-to-guides-for-staff/how-to-v2mom)'),
                        newChecklistItem('Align on role responsibilities and expectations'),
                        newChecklistItem(
                            'COM Introduction',
                            'New team members are invited to introduce themselves at [COM](https://handbook.mattermost.com/operations/operations/company-cadence#customer-obsession-meeting-aka-com) during their second week. If they\'re not comfortable doing their own introduction, Managers will do so on their behalf.',
                        ),
                        newChecklistItem(
                            '[Shoulder Check](https://handbook.mattermost.com/company/about-mattermost/mindsets#shoulder-check)',
                            'Assess potential blindspots and ask for feedback.',
                        ),
                    ],
                },
                {
                    title: 'Month two',
                    items: [
                        newChecklistItem(
                            '90-day New Colleague Feedback',
                            'Managers are notified to kick off the [New Colleague Review Process](https://handbook.mattermost.com/contributors/onboarding#new-colleague-90-day-feedback-process) on their new staff member\'s 65th day. The feedback will include a summary of the new staff member\'s responsibilities during the first 90 days. Managers should communicate these responsibilities to the new staff member during their first week.',
                        ),
                    ],
                },
                {
                    title: 'Month three',
                    items: [
                        newChecklistItem('Deliver New Colleague Feedback'),
                    ],
                },
            ],
            create_public_playbook_run: false,
            channel_name_template: 'Employee Onboarding: <name>',
            message_on_join_enabled: true,
            message_on_join:
                mtrim`Hello and welcome!

                This channel was created as part of the **Employee Onboarding** playbook and is where conversations related to onboarding this employee are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.`,
            run_summary_template: '',
            reminder_timer_default_seconds: 7 * 24 * 60 * 60, // once a week
            retrospective_template:
                mtrim`### What went well?
                -

                ### What could have gone better?
                -

                ### What should be changed for next time?
                - `,
            retrospective_reminder_interval_seconds: 0, // Once
        },
    },
    {
        title: 'Feature Lifecycle',
        description: 'Create transparent workflows across development teams to ensure your feature development process is seamless.',
        icon: <Gears/>,
        color: '#62697E14',
        author: <MattermostLogo/>,
        template: {
            ...emptyPlaybook(),
            title: 'Feature Lifecycle',
            description: 'Customize this playbook to reflect your own feature lifecycle process.',
            checklists: [
                {
                    title: 'Plan',
                    items: [
                        newChecklistItem('Explain what the problem is and why it\'s important'),
                        newChecklistItem('Explain proposal for potential solutions'),
                        newChecklistItem('List out open questions and assumptions'),
                        newChecklistItem('Set the target release date'),
                    ],
                },
                {
                    title: 'Kickoff',
                    items: [
                        newChecklistItem(
                            'Choose an engineering owner for the feature',
                            mtrim`Expectations for the owner:
                            - Responsible for setting and meeting expectation for target dates' +
                            - Post weekly status update' +
                            - Demo feature at R&D meeting' +
                            - Ensure technical quality after release`,
                        ),
                        newChecklistItem('Identify and invite contributors to the feature channel'),
                        newChecklistItem(
                            'Schedule kickoff and recurring check-in meetings',
                            mtrim`Expectations leaving the kickoff meeting:
                            - Alignment on the precise problem in addition to rough scope and target
                            - Clear next steps and deliverables for each individual`,
                        ),
                    ],
                },
                {
                    title: 'Build',
                    items: [
                        newChecklistItem(
                            'Align on scope, quality, and time.',
                            'There are likely many different efforts to achieve alignment here, this checkbox just symbolizes sign-off from contributors.',
                        ),
                        newChecklistItem('Breakdown feature milestones and add them to this checklist'),
                    ],
                },
                {
                    title: 'Ship',
                    items: [
                        newChecklistItem('Update documentation and user guides'),
                        newChecklistItem('Merge all feature and bug PRs to master'),
                        newChecklistItem(
                            'Demo to the community',
                            mtrim`For example:
                            - R&D meeting
                            - Developer meeting
                            - Company wide meeting`
                        ),
                        newChecklistItem('Build telemetry dashboard to measure adoption'),
                        newChecklistItem(
                            'Create launch kit for go-to-market teams',
                            mtrim`Including but not exclusive to:
                            - release blog post
                            - one-pager
                            - demo video`,
                        ),
                    ],
                },
                {
                    title: 'Follow up',
                    items: [
                        newChecklistItem('Schedule meeting to review adoption metrics and user feedback'),
                        newChecklistItem('Plan improvements and next iteration'),
                    ],
                },
            ],
            create_public_playbook_run: true,
            channel_name_template: 'Feature: <name>',
            message_on_join_enabled: true,
            message_on_join:
                mtrim`Hello and welcome!

                This channel was created as part of the **Feature Lifecycle** playbook and is where conversations related to developing this feature are held. You can customize this message using Markdown so that every new channel member can be welcomed with helpful context and resources.`,
            run_summary_template_enabled: true,
            run_summary_template:
                mtrim`**One-liner**
                <ie. Enable users to prescribe a description template so it\'s consistent for every run and therefore easier to read.>

                **Targets release**
                - Code complete: date
                - Customer release: month

                **Resources**
                - Jira Epic: <link>
                - UX prototype: <link>
                - Technical design: <link>
                - User docs: <link>`,
            reminder_message_template:
                mtrim`### Demo
                <Insert_GIF_here>

                ### Changes since last week
                -

                ### Risks
                - `,
            reminder_timer_default_seconds: 24 * 60 * 60, // 1 day
            retrospective_template:
                mtrim`### Start
                -

                ### Stop
                -

                ### Keep
                - `,
            retrospective_reminder_interval_seconds: 0, // Once
        },
    },
    {
        title: 'Bug Bash',
        description: 'Customize this playbook to reflect your own bug bash process.',
        icon: <BugSearch/>,
        color: '#7A560014',
        author: <MattermostLogo/>,
        template: {
            ...emptyPlaybook(),
            title: 'Bug Bash',
            description: mtrim`About once or twice a month, the Mattermost Playbooks team uses this playbook to run a 50 minute bug-bash testing the latest version of Playbooks.

            Customize this playbook to reflect your own bug bash process.`,
            create_public_playbook_run: true,
            channel_name_template: 'Bug Bash (vX.Y)',
            checklists: [
                {
                    title: 'Setup Testing Environment (Before Meeting)',
                    items: [
                        newChecklistItem(
                            'Deploy the build in question to community-daily',
                        ),
                        newChecklistItem(
                            'Spin up a cloud instance running T0',
                            '',
                            '/cloud create playbooks-bug-bash-t0 --license te --image mattermost/mattermost-team-edition --test-data --version master',
                        ),
                        newChecklistItem(
                            'Spin up a cloud instance running E0',
                            '',
                            '/cloud create playbooks-bug-bash-e0 --license te --test-data --version master',
                        ),
                        newChecklistItem(
                            'Spin up a cloud instance running E10',
                            '',
                            '/cloud create playbooks-bug-bash-e10 --license e10 --test-data --version master',
                        ),
                        newChecklistItem(
                            'Spin up a cloud instance running E20',
                            '',
                            '/cloud create playbooks-bug-bash-e20 --license e20 --test-data --version master',
                        ),
                        newChecklistItem(
                            'Enable Open Servers & CRT for all Cloud Instances',
                            mtrim`From a command line, login to each server in turn via [\`mmctl\`](https://github.com/mattermost/mmctl), and configure, e.g.:
                                \`\`\`
                                for server in playbooks-bug-bash-t0 playbooks-bug-bash-e0 playbooks-bug-bash-e10 playbooks-bug-bash-e20; do
                                    mmctl auth login https://$server.test.mattermost.cloud --name $server --username sysadmin --password-file <(echo "Sys@dmin123");
                                    mmctl config set TeamSettings.EnableOpenServer true;
                                    mmctl config set ServiceSettings.CollapsedThreads default_on;
                                done
                                \`\`\``,
                        ),
                        newChecklistItem(
                            'Install the plugin to each instance',
                            mtrim`From a command line, login to each server in turn via [\`mmctl\`](https://github.com/mattermost/mmctl), and configure, e.g.:
                                \`\`\`
                                for server in playbooks-bug-bash-t0 playbooks-bug-bash-e0 playbooks-bug-bash-e10 playbooks-bug-bash-e20; do
                                    mmctl auth login https://$server.test.mattermost.cloud --name $server --username sysadmin --password-file <(echo "Sys@dmin123");
                                    mmctl plugin install-url --force https://github.com/mattermost/mattermost-plugin-playbooks/releases/download/v1.22.0%2Balpha.3/playbooks-1.22.0+alpha.3.tar.gz
                                done
                                \`\`\``,
                        ),
                        newChecklistItem(
                            'Announce Bug Bash',
                            'Make sure the team and community is aware of the upcoming bug bash.',
                        ),
                    ],
                },
                {
                    title: 'Define Scope (10 Minutes)',
                    items: [
                        newChecklistItem(
                            'Review GitHub commit diff',
                        ),
                        newChecklistItem(
                            'Identify new features to add to target testing areas checklist',
                        ),
                        newChecklistItem(
                            'Identify existing functionality to add to target testing areas checklist',
                        ),
                        newChecklistItem(
                            'Add relevant T0/E0/E10/E20 permutations',
                        ),
                        newChecklistItem(
                            'Assign owners',
                        ),
                    ],
                },
                {
                    title: 'Target Testing Areas (30 Minutes)',
                    items: [],
                },
                {
                    title: 'Triage (10 Minutes)',
                    items: [
                        newChecklistItem(
                            'Review issues to identify what to fix for the upcoming release',
                        ),
                        newChecklistItem(
                            'Assign owners for all required bug fixes',
                        ),
                    ],
                },
                {
                    title: 'Clean Up',
                    items: [
                        newChecklistItem(
                            'Clean up cloud instance running T0',
                            '',
                            '/cloud delete playbooks-bug-bash-t0',
                        ),
                        newChecklistItem(
                            'Clean up cloud instance running E0',
                            '',
                            '/cloud delete playbooks-bug-bash-e0',
                        ),
                        newChecklistItem(
                            'Clean up cloud instance running E10',
                            '',
                            '/cloud delete playbooks-bug-bash-e10',
                        ),
                        newChecklistItem(
                            'Clean up cloud instance running E20',
                            '',
                            '/cloud delete playbooks-bug-bash-e20',
                        ),
                    ],
                },
            ],
            status_update_enabled: true,
            message_on_join: mtrim`Welcome! We're using this channel to run a 50 minute bug-bash the new version of Playbooks. The first 10 minutes will be spent identifying scope and ownership, followed by 30 minutes of targeted testing in the defined areas, and 10 minutes of triage.

            When you find an issue, post a new thread in this channel tagged #bug and share any screenshots and reproduction steps. The owner of this bash will triage the messages into tickets as needed.`,
            message_on_join_enabled: true,
            retrospective_enabled: false,
            run_summary_template_enabled: true,
            run_summary_template: mtrim`The playbooks team is executing a bug bash to qualify the next shipping version.

            As we encounter issues, simply start a new thread and tag with #bug (or #feature) to make tracking these easier.

            **Release Link**: TBD
            **Zoom**: TBD
            **Triage Filter**: https://mattermost.atlassian.net/secure/RapidBoard.jspa?rapidView=68&projectKey=MM&view=planning.nodetail&quickFilter=332&issueLimit=100

            | Servers |
            | -- |
            | [T0](https://playbooks-bug-bash-t0.test.mattermost.cloud) |
            | [E0](https://playbooks-bug-bash-e0.test.mattermost.cloud) |
            | [E10](https://playbooks-bug-bash-e10.test.mattermost.cloud) |
            | [E20](https://playbooks-bug-bash-e20.test.mattermost.cloud) |

            Login with:

            | Username | Password |
            | -- | -- |
            | sysadmin | Sys@dmin123 |`,
        },
    },
    {
        title: 'Learn how to use playbooks',
        label: 'Recommended For Beginners',
        labelColor: '#E5AA1F29-#A37200',
        icon: <LightBulb/>,
        color: '#FFBC1F14',
        author: <MattermostLogo/>,
        description: 'New to playbooks? This playbook will help you get familiar with playbooks, configurations, and playbook runs.',
        template: {
            ...emptyPlaybook(),
            title: 'Learn how to use playbooks',
            description: mtrim`Use this playbook to learn more about playbooks. Go through this page to check out the contents or simply select ‘start a test run’ in the top right corner.`,
            create_public_playbook_run: true,
            channel_name_template: 'Onboarding Run',
            checklists: [
                {
                    title: 'Learn',
                    items: [
                        newChecklistItem(
                            'Try editing the run name or description in the top section of this page.',
                        ),
                        newChecklistItem(
                            'Try checking off the first two tasks!',
                        ),
                        newChecklistItem(
                            'Assign a task to yourself or another member.',
                        ),
                        newChecklistItem(
                            'Post your first status update.',
                        ),
                        newChecklistItem(
                            'Complete your first checklist!',
                        ),
                    ],
                },
                {
                    title: 'Collaborate',
                    items: [
                        newChecklistItem(
                            'Invite other team members that you’d like to collaborate with.',
                        ),
                        newChecklistItem(
                            'Skip a task.',
                        ),
                        newChecklistItem(
                            'Finish the run.',
                        ),
                    ],
                },
            ],
            status_update_enabled: true,
            reminder_timer_default_seconds: 50 * 60, // 50 minutes
            message_on_join: '',
            message_on_join_enabled: false,
            retrospective_enabled: false,
            run_summary_template_enabled: true,
            run_summary_template: mtrim`This summary area helps everyone involved gather context at a glance. It supports markdown syntax just like a channel message, just click to edit and try it out!

            - Start date: 20 Dec, 2021
            - Target date: To be determined
            - User guide: Playbooks docs`,
        },
    },
]);

export default PresetTemplates;
