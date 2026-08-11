// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {
    AccessControlPolicy,
    PolicySimulationActionDecision,
    PolicySimulationBlame,
    PolicySimulationEvaluationNode,
} from '@mattermost/types/access_control';
import {
    POLICY_SIMULATION_BLAME_SOURCES,
    POLICY_SIMULATION_EVALUATION_NODE_KIND,
    POLICY_SIMULATION_EVALUATION_OUTCOME,
} from '@mattermost/types/access_control';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import ProfilePicture from 'components/profile_picture';

import DecisionChip from './decision_chip';

import './decision_details_modal.scss';

type Props = {
    onExited: () => void;
    user: UserProfile;
    actions: string[];
    actionLabels?: Record<string, string>;
    decisions?: Record<string, PolicySimulationActionDecision>;
    pending: boolean;

    /** Draft policy currently being edited. Used to fall back to a
     *  client-side expression lookup for `this_rule` / `sibling_rule`
     *  blame entries when the server didn't pre-populate
     *  `blame.expression`. We never look up peer policies here — those
     *  rely on server-side enrichment. */
    policy?: AccessControlPolicy;

    /** User profile attribute snapshot used for evaluation
     *  (department, region, etc.). Rendered as an evaluation-trace
     *  block above the per-action list. Hidden when undefined. */
    userAttributes?: Record<string, string>;

    /** Session-attribute snapshot for the active session whose chip
     *  opened this modal. Rendered alongside userAttributes. Hidden
     *  when undefined. */
    sessionAttributes?: Record<string, string>;
};

/**
 * Stacked sub-modal that breaks a row's aggregate chip down to the
 * per-permission decisions and surfaces an evaluation trace for each
 * deny: rule name + CEL expression + the attribute values that fed the
 * evaluation. Mounted with `isStacked={true}` so it sits above the main
 * SimulateAccessModal without dismounting it. Read-only — decisions are
 * passed in by the picker; the modal doesn't re-dispatch the simulator.
 *
 * Privacy boundary: the failing rule's expression is only rendered for
 * blame entries at the draft's own scope (`this_rule`, `sibling_rule`,
 * `sibling_saved`, `peer_policy`). Truly upper-scoped sources
 * (`system_permission`, `channel_policy`) render the chip alone — the
 * server intentionally omits their expression to avoid leaking the
 * contents of an out-of-scope policy.
 */
export default function DecisionDetailsModal({
    onExited,
    user,
    actions,
    actionLabels,
    decisions,
    pending,
    policy,
    userAttributes,
    sessionAttributes,
}: Props): JSX.Element {
    const {formatMessage} = useIntl();

    // Local visibility state so the close click runs the exit
    // transition before the parent unmounts us. Without this the X
    // click fires `onExited` directly → parent flips its
    // `showDetails` flag → we unmount instantly → React-Bootstrap
    // never plays the modal's slide-out and the parent backdrop
    // briefly flickers as the stacked-modal counter resets. With
    // local state, `onHide` only flags us as hidden; the transition
    // plays, then GenericModal calls the real `onExited` and the
    // parent removes us cleanly.
    const [show, setShow] = useState(true);
    const handleHide = useCallback(() => setShow(false), []);

    // Narrow into a defined-or-undefined local so the JSX below doesn't
    // need a non-null assertion — checking `userAttributes` indirectly
    // through `hasUserAttrs` would lose the narrowing.
    const userAttrs = userAttributes && Object.keys(userAttributes).length > 0 ? userAttributes : undefined;
    const sessionAttrs = sessionAttributes && Object.keys(sessionAttributes).length > 0 ? sessionAttributes : undefined;

    return (
        <GenericModal
            id='simulateAccessDecisionDetailsModal'
            className='SimulateAccessModal__details a11y__modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            isStacked={true}
            compassDesign={true}
            showCloseButton={true}
            bodyPadding={true}
            ariaLabel={formatMessage({
                id: 'admin.access_control.simulate_access.details.title',
                defaultMessage: 'Decision details',
            })}
            modalHeaderText={
                <FormattedMessage
                    id='admin.access_control.simulate_access.details.title'
                    defaultMessage='Decision details'
                />
            }
        >
            <div className='SimulateAccessModal__detailsHeader'>
                {/* ProfilePicture with userId opens the standard profile
                  * popover on click — matches the affordance from the
                  * picker row so authors can drill into attribute/role
                  * details from this drilled-down view too. */}
                <div className='SimulateAccessModal__detailsAvatar'>
                    <ProfilePicture
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        userId={user.id}
                        username={user.username}
                        size='lg'
                    />
                </div>
                <div className='SimulateAccessModal__detailsIdentity'>
                    <span
                        className='SimulateAccessModal__detailsDisplayName'
                        title={displayUsername(user, 'full_name') || user.username}
                    >
                        {displayUsername(user, 'full_name') || user.username}
                    </span>
                    <span
                        className='SimulateAccessModal__detailsUsername'
                        title={`@${user.username}`}
                    >{`@${user.username}`}</span>
                </div>
            </div>

            {(userAttrs || sessionAttrs) ? (
                <div
                    className='SimulateAccessModal__detailsAttributes'
                    data-testid='simulate-access-details-attributes'
                >
                    {userAttrs ? (
                        <AttributeSection
                            heading={
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.details.user_attributes'
                                    defaultMessage='User attributes'
                                />
                            }
                            values={userAttrs}
                            testId='simulate-access-details-user-attributes'
                        />
                    ) : null}
                    {sessionAttrs ? (
                        <AttributeSection
                            heading={
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.details.session_attributes'
                                    defaultMessage='Session attributes'
                                />
                            }
                            values={sessionAttrs}
                            testId='simulate-access-details-session-attributes'
                        />
                    ) : null}
                </div>
            ) : null}

            <ul className='SimulateAccessModal__detailsList'>
                {actions.map((action) => {
                    const dec = decisions?.[action];
                    const traces = !pending && dec ? deriveTraces(dec, action, policy) : [];
                    return (
                        <ActionDetailsRow
                            key={action}
                            action={action}
                            label={actionLabels?.[action] ?? action}
                            decision={dec}
                            pending={pending}
                            traces={traces}
                        />
                    );
                })}
            </ul>
        </GenericModal>
    );
}

type ActionDetailsRowProps = {
    action: string;
    label: string;
    decision: PolicySimulationActionDecision | undefined;
    pending: boolean;
    traces: DenyTrace[];
};

/**
 * One row in the modal's per-action list: action label + decision
 * chip on the always-visible header, with the rule + expression /
 * evaluation-tree details collapsed behind a disclosure toggle. The
 * details start hidden so the modal opens with a tight summary view
 * and the author opts in to the deeper trace per-action; this avoids
 * scrolling through long CEL expressions or deeply nested trees by
 * default when a row is uninteresting (e.g. an allow).
 */
function ActionDetailsRow({action, label, decision, pending, traces}: ActionDetailsRowProps): JSX.Element {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <li
            className='SimulateAccessModal__detailsItem'
            data-testid={`simulate-access-details-${action}`}
        >
            <div className='SimulateAccessModal__detailsRow'>
                <span className='SimulateAccessModal__detailsLabel'>
                    {label}
                </span>
                <DecisionChip
                    decision={decision}
                    pending={pending}
                />
            </div>
            {traces.length > 0 ? (
                <>
                    <button
                        type='button'
                        className='SimulateAccessModal__detailsToggle'
                        data-testid={`simulate-access-details-toggle-${action}`}
                        aria-expanded={showDetails}
                        aria-controls={`simulate-access-details-rule-${action}`}
                        onClick={() => setShowDetails((s) => !s)}
                    >
                        {showDetails ? (
                            <FormattedMessage
                                id='admin.access_control.simulate_access.details.hide_trace'
                                defaultMessage='Hide evaluation trace'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.access_control.simulate_access.details.show_trace'
                                defaultMessage='Show evaluation trace'
                            />
                        )}
                        <i
                            className={classNames('icon', {
                                'icon-chevron-down': !showDetails,
                                'icon-chevron-up': showDetails,
                            })}
                            aria-hidden='true'
                        />
                    </button>
                    {showDetails ? (
                        <div
                            id={`simulate-access-details-rule-${action}`}
                            data-testid={`simulate-access-details-rule-${action}`}
                            className={classNames(
                                'SimulateAccessModal__detailsRule',
                                {'SimulateAccessModal__detailsRule--multiPolicy': traces.length > 1},
                            )}
                        >
                            {traces.length > 1 ? (
                                <MultiPolicyTraces
                                    action={action}
                                    traces={traces}
                                />
                            ) : (
                                <SingleTraceBlock
                                    action={action}
                                    trace={traces[0]}
                                />
                            )}
                        </div>
                    ) : null}
                </>
            ) : null}
        </li>
    );
}

type SingleTraceBlockProps = {
    action: string;
    trace: DenyTrace;
    policyIndex?: number;
};

/**
 * One contributing policy's trace: optional policy header (peer/system
 * permission denies surface a "Policy: <name>" line; the editing draft
 * stays anonymous) followed by the rule-level header and tree body.
 *
 * `policyIndex` is set when this section is rendered as part of a
 * multi-policy block — it stamps a numbered badge so authors can map
 * the section back to its entry in the policy list above. When a
 * `policyIndex` is set the section also surfaces an outcome chip
 * (Allowed / Denied) so authors can tell at a glance which policies
 * contributed to the deny vs. which informational entries (e.g. the
 * editing draft itself) tell them their own policy allowed.
 */
function SingleTraceBlock({action, trace, policyIndex}: SingleTraceBlockProps): JSX.Element {
    const isInMultiPolicy = policyIndex !== undefined;
    const sectionTestId = isInMultiPolicy ?
        `simulate-access-details-policy-${action}-${policyIndex}` :
        undefined;
    const showHeader = Boolean(trace.policyName) || isInMultiPolicy;
    return (
        <div
            className='SimulateAccessModal__detailsPolicySection'
            data-testid={sectionTestId}
        >
            {showHeader ? (
                <div className='SimulateAccessModal__detailsPolicyHeader'>
                    {isInMultiPolicy ? (
                        <span
                            className='SimulateAccessModal__detailsPolicyBadge'
                            aria-hidden='true'
                        >
                            {policyIndex}
                        </span>
                    ) : null}
                    {trace.policyName ? (
                        <div className='SimulateAccessModal__detailsPolicy'>
                            <FormattedMessage
                                id='admin.access_control.simulate_access.details.policy_label'
                                defaultMessage='Policy: {name}'
                                values={{name: trace.policyName}}
                            />
                        </div>
                    ) : null}
                    {isInMultiPolicy ? (
                        <PolicyOutcomeChip
                            outcome={trace.outcome}
                            isEditingDraft={!trace.policyName}
                        />
                    ) : null}
                </div>
            ) : null}
            <TraceOriginHeader
                action={action}
                trace={trace}
            />
            <TraceBody
                action={action}
                trace={trace}
                policyIndex={policyIndex}
            />
        </div>
    );
}

type PolicyOutcomeChipProps = {
    outcome: 'allow' | 'deny';
    isEditingDraft: boolean;
};

/**
 * Small allow / deny pill rendered next to a per-policy section in
 * multi-policy mode. The wording differentiates the editing draft
 * ("Your policy: Allowed/Denied") from named peers
 * ("Allowed/Denied") so the author can tell their own contribution
 * apart from peer policies' contributions at a glance.
 */
function PolicyOutcomeChip({outcome, isEditingDraft}: PolicyOutcomeChipProps): JSX.Element {
    const className = classNames(
        'SimulateAccessModal__detailsPolicyOutcome',
        `SimulateAccessModal__detailsPolicyOutcome--${outcome}`,
    );
    if (isEditingDraft) {
        return (
            <span className={className}>
                {outcome === 'allow' ? (
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.your_policy_allowed'
                        defaultMessage='Your policy: Allowed'
                    />
                ) : (
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.your_policy_denied'
                        defaultMessage='Your policy: Denied'
                    />
                )}
            </span>
        );
    }
    return (
        <span className={className}>
            {outcome === 'allow' ? (
                <FormattedMessage
                    id='admin.access_control.simulate_access.details.policy_allowed'
                    defaultMessage='Allowed'
                />
            ) : (
                <FormattedMessage
                    id='admin.access_control.simulate_access.details.policy_denied'
                    defaultMessage='Denied'
                />
            )}
        </span>
    );
}

type MultiPolicyTracesProps = {
    action: string;
    traces: DenyTrace[];
};

/**
 * Renders one numbered section per contributing same-scope policy.
 * Used in the system console (and any future scope where a deny can
 * have multiple same-scope contributors) so authors can see exactly
 * which policies caused the deny — and within each, which rules
 * merged together. Order matches `rankSameScopeBlames`: the editing
 * draft first, then peer / same-scope system policies.
 *
 * Upper-scoped policies (`system_permission` from a non-system
 * editor's view, `channel_policy`) never reach this list because
 * `deriveTraces` filters them out at the source — so we don't need
 * an extra privacy guard here.
 */
function MultiPolicyTraces({action, traces}: MultiPolicyTracesProps): JSX.Element {
    const denyCount = traces.filter((t) => t.outcome === 'deny').length;
    const allowCount = traces.length - denyCount;
    return (
        <div
            className='SimulateAccessModal__detailsPolicies'
            data-testid={`simulate-access-details-policies-${action}`}
        >
            <div className='SimulateAccessModal__detailsPoliciesHead'>
                {allowCount > 0 ? (

                    // Mixed allow + deny: a peer denied while another policy
                    // (typically the editing draft) allowed. Spell that out
                    // so authors don't think the picker is hiding policies
                    // that allowed.
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.multi_policy_explainer_mixed'
                        defaultMessage='{denyCount, plural, one {# policy} other {# policies}} denied; {allowCount, plural, one {# policy} other {# policies}} allowed. Multiple policies on the same scope combine with deny-wins, so any single deny produces an overall deny.'
                        values={{denyCount, allowCount}}
                    />
                ) : (
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.multi_policy_explainer'
                        defaultMessage='{count, plural, one {# policy} other {# policies}} contributed to this deny. Numbered sections below show each policy in turn.'
                        values={{count: traces.length}}
                    />
                )}
            </div>
            {traces.map((trace, idx) => (
                <SingleTraceBlock
                    key={`${trace.policyName ?? 'editing'}-${idx}`}
                    action={action}
                    trace={trace}
                    policyIndex={idx + 1}
                />
            ))}
        </div>
    );
}

type AttributeSectionProps = {
    heading: React.ReactNode;
    values: Record<string, string>;
    testId: string;
};

function AttributeSection({heading, values, testId}: AttributeSectionProps): JSX.Element {
    const entries = Object.entries(values);
    return (
        <div
            className='SimulateAccessModal__detailsAttributeGroup'
            data-testid={testId}
        >
            <div className='SimulateAccessModal__detailsAttributeHeading'>{heading}</div>
            <dl className='SimulateAccessModal__detailsAttributeList'>
                {entries.map(([key, value]) => (
                    <div
                        key={key}
                        className='SimulateAccessModal__detailsAttributeRow'
                    >
                        <dt
                            className='SimulateAccessModal__detailsAttributeKey'
                            title={key}
                        >
                            {key}
                        </dt>
                        <dd
                            className='SimulateAccessModal__detailsAttributeValue'
                            title={value}
                        >
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

type DenyTrace = {
    expression: string;
    ruleName?: string;
    policyName?: string;

    /** Role the contributing rule(s) targeted (channel_admin /
     *  channel_user / channel_guest / system_admin / ...). When set
     *  the header surfaces it instead of (or in addition to) a single
     *  rule name. */
    role?: string;

    /** Per-policy verdict. `'deny'` is the default — these are the
     *  contributors that produced the overall deny. `'allow'` is the
     *  informational flavor the simulator emits to surface the
     *  editing draft's evaluation when a peer policy is the actual
     *  denier; the multi-policy renderer paints those sections green
     *  and labels them "Allowed by this policy" so the author can
     *  tell their own draft apart from the deniers. */
    outcome: 'deny' | 'allow';

    /** Per-rule breakdown for blame entries whose merged expression
     *  combines more than one authored rule (engine.JoinExpressions
     *  OR-fold). Each entry comes from the server's
     *  `blame.merged_rules` and carries the rule's name plus its
     *  standalone evaluation tree, so the picker can render numbered
     *  per-rule sections that line up 1:1 with the merged tree's
     *  branches. The merged AST shape is ambiguous on its own (see
     *  type comment in @mattermost/types/access_control), which is
     *  why we trust the server-provided list rather than reconstructing
     *  it client-side.
     *
     *  Empty / single-element when no merging is happening — the
     *  header keeps the simpler "Rule: <name>" wording in that case. */
    mergedRules?: MergedRuleEntry[];

    /** Per-node evaluation breakdown of the failing rule, when the
     *  server attached one. Renders as a structured AND/OR/NOT tree
     *  with outcome coloring; absent → fall back to flat
     *  expression text. */
    evaluationTree?: PolicySimulationEvaluationNode;
};

type MergedRuleEntry = {
    name: string;
    expression?: string;
    evaluationTree?: PolicySimulationEvaluationNode;
};

type TraceOriginHeaderProps = {
    action: string;
    trace: DenyTrace;
};

/**
 * Header above the evaluation tree that explains where the trace's
 * expression came from. The simulator merges every draft-policy rule
 * that targets the same `(role, action)` pair using OR
 * (`engine.JoinExpressions`), so a single trace can already be a
 * combination of multiple authored rules — calling out only one of
 * them ("Rule: <X>") was misleading when the user could see branches
 * from siblings as well.
 *
 * Behavior:
 *  - **Multiple draft rules merged**: render an explicit
 *    "Combined evaluation for role · action" label with a help-icon
 *    tooltip that lists every contributing rule, so the author can
 *    map branches in the tree back to the rules that produced them.
 *  - **Single source rule**: keep the simpler "Rule: <name>" line —
 *    no merging is happening so the original wording is accurate.
 *  - **Unnamed rule, no role**: render nothing (the tree itself is
 *    enough context).
 */
function TraceOriginHeader({action, trace}: TraceOriginHeaderProps): JSX.Element | null {
    const {formatMessage} = useIntl();
    const {ruleName, role, mergedRules} = trace;
    const merged = mergedRules ?? [];
    const hasMerge = merged.length > 1;

    if (hasMerge) {
        return (
            <div
                className='SimulateAccessModal__detailsRuleName SimulateAccessModal__detailsRuleName--combined'
                data-testid={`simulate-access-details-origin-${action}`}
            >
                {role ? (
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.combined_label_with_role'
                        defaultMessage='Combined evaluation for role {role}'
                        values={{role}}
                    />
                ) : (
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.combined_label'
                        defaultMessage='Combined evaluation'
                    />
                )}
                <WithTooltip
                    title={
                        <CombinedRulesTooltip rules={merged}/>
                    }
                >
                    <button
                        type='button'
                        className='SimulateAccessModal__detailsCombinedHelp'
                        data-testid={`simulate-access-details-origin-help-${action}`}
                        aria-label={formatMessage({
                            id: 'admin.access_control.simulate_access.details.show_contributing_rules',
                            defaultMessage: 'Show contributing rules',
                        })}
                    >
                        <i
                            className='icon icon-help-circle-outline'
                            aria-hidden='true'
                        />
                    </button>
                </WithTooltip>
            </div>
        );
    }

    if (ruleName) {
        return (
            <div className='SimulateAccessModal__detailsRuleName'>
                <FormattedMessage
                    id='admin.access_control.simulate_access.details.rule_label'
                    defaultMessage='Rule: {name}'
                    values={{name: ruleName}}
                />
            </div>
        );
    }

    return null;
}

function CombinedRulesTooltip({rules}: {rules: MergedRuleEntry[]}): JSX.Element {
    return (
        <div className='SimulateAccessModal__detailsCombinedTooltip'>
            <div className='SimulateAccessModal__detailsCombinedTooltipHead'>
                <FormattedMessage
                    id='admin.access_control.simulate_access.details.combined_explainer'
                    defaultMessage='These rules are joined with OR. Any one of them matching is enough to allow access; this trace shows them merged together.'
                />
            </div>
            <ol className='SimulateAccessModal__detailsCombinedTooltipList'>
                {rules.map((rule, idx) => (
                    <li key={`${rule.name}-${idx}`}>
                        {rule.name}
                    </li>
                ))}
            </ol>
        </div>
    );
}

type TraceBodyProps = {
    action: string;
    trace: DenyTrace;

    /** When this trace is rendered as one of N policy sections, the
     *  outer policy index is forwarded down to MergedRuleSection so
     *  rule badges read as "1.1", "1.2" rather than the raw "1", "2"
     *  — that distinguishes the inner (rule) numbering from the outer
     *  (policy) numbering and avoids a same-number collision when a
     *  policy contributing to a deny ALSO has multiple OR-merged
     *  rules. Undefined for the standalone (single-policy) view, in
     *  which case rule badges read as flat "1", "2", ... */
    policyIndex?: number;
};

/**
 * Renders the body of a trace: either N numbered per-rule sections —
 * one for each rule the simulator OR-folded into the merged
 * expression, when the server attached per-rule evaluation trees —
 * or the single merged tree (current default), or a flat expression
 * fallback when no tree was attached at all. Numbered sections give
 * the author a 1:1 mapping between branches in the tree and rules
 * they authored, which the merged AST shape can't communicate on its
 * own. Each numbered section's tree is the standalone evaluation of
 * just that rule against the same activation, so per-rule chips
 * (TRUE / FALSE / ERROR) line up with the attribute values shown.
 */
function TraceBody({action, trace, policyIndex}: TraceBodyProps): JSX.Element {
    const merged = trace.mergedRules ?? [];

    // Per-rule numbered sections only render when the server attached
    // an evaluation_tree for at least one entry: with names alone we
    // have nothing extra to show beyond the merged tree, so falling
    // back keeps the UI useful for older simulators while picking up
    // the richer view automatically when a newer server populates the
    // per-rule trees.
    const hasPerRuleTrees = merged.length > 1 && merged.some((m) => m.evaluationTree);

    if (hasPerRuleTrees) {
        return (
            <div
                className='SimulateAccessModal__detailsMergedRules'
                data-testid={`simulate-access-details-merged-${action}`}
            >
                {merged.map((rule, idx) => (
                    <MergedRuleSection
                        key={`${rule.name}-${idx}`}
                        action={action}
                        index={idx + 1}
                        policyIndex={policyIndex}
                        rule={rule}
                    />
                ))}
            </div>
        );
    }

    if (trace.evaluationTree) {
        return (
            <div
                className='SimulateAccessModal__detailsTree'
                data-testid={`simulate-access-details-tree-${action}`}
            >
                <ExpressionTraceNode node={trace.evaluationTree}/>
            </div>
        );
    }

    return (
        <code className='SimulateAccessModal__detailsExpression'>
            {trace.expression}
        </code>
    );
}

type MergedRuleSectionProps = {
    action: string;
    index: number;
    rule: MergedRuleEntry;

    /** When set, the badge renders as "{policyIndex}.{index}" (e.g.
     *  "1.1", "1.2") so rule numbers are visibly nested under their
     *  parent policy. Without this, two layers of "1" / "2" badges
     *  collide when a multi-policy deny includes a policy with
     *  multiple OR-merged rules. Undefined in the single-policy
     *  (channel-settings) view where flat "1", "2" is unambiguous. */
    policyIndex?: number;
};

/**
 * One numbered section in the per-rule breakdown of a merged blame.
 * The numeric badge ([1], [2], ...) matches the position in the
 * server-provided `merged_rules` list, which itself matches
 * JoinExpressions' input order — so authors can map this section
 * directly back to the same numbered entry in the help-icon tooltip
 * above. When the section is nested inside a multi-policy view,
 * `policyIndex` makes the badge read "1.1", "1.2", ... so rule
 * numbering doesn't collide with policy numbering.
 */
function MergedRuleSection({action, index, rule, policyIndex}: MergedRuleSectionProps): JSX.Element {
    const badgeLabel = policyIndex === undefined ? `${index}` : `${policyIndex}.${index}`;
    return (
        <div
            className='SimulateAccessModal__detailsMergedRule'
            data-testid={`simulate-access-details-merged-rule-${action}-${index}`}
        >
            <div className='SimulateAccessModal__detailsMergedRuleHeader'>
                <span
                    className='SimulateAccessModal__detailsMergedRuleBadge'
                    aria-hidden='true'
                >
                    {badgeLabel}
                </span>
                <span className='SimulateAccessModal__detailsMergedRuleName'>
                    <FormattedMessage
                        id='admin.access_control.simulate_access.details.rule_label'
                        defaultMessage='Rule: {name}'
                        values={{name: rule.name}}
                    />
                </span>
            </div>
            <MergedRuleBody rule={rule}/>
        </div>
    );
}

/**
 * Body of a merged-rule section: prefer the standalone evaluation
 * tree (when the simulator attached one), fall back to the flat CEL
 * text, render nothing when neither is available. Split out as its
 * own component to keep MergedRuleSection's JSX free of nested
 * ternaries while still encoding the same precedence.
 */
function MergedRuleBody({rule}: {rule: MergedRuleEntry}): JSX.Element | null {
    if (rule.evaluationTree) {
        return (
            <div className='SimulateAccessModal__detailsTree'>
                <ExpressionTraceNode node={rule.evaluationTree}/>
            </div>
        );
    }
    if (rule.expression) {
        return (
            <code className='SimulateAccessModal__detailsExpression'>
                {rule.expression}
            </code>
        );
    }
    return null;
}

/**
 * Returns one or more rule + expression (and optional evaluation
 * tree) traces to surface for a decision. Each entry corresponds to a
 * distinct same-scope contributing policy: a single peer policy on
 * the same scope, the editing draft itself, or — in the system
 * console where multiple system policies can co-deny — every
 * `system_permission` policy whose rules the simulator could attach.
 * Order is by `SAME_SCOPE_SOURCE_PRIORITY` (this_rule first, peer
 * policies after siblings) and then by the order blame entries arrive
 * from the server, with duplicates collapsed by `(policy_id, role)`
 * so a policy contributing to multiple roles still appears once.
 *
 * For draft-side blame (`this_rule`/`sibling_rule`/`sibling_saved`)
 * we fall back to looking up the expression in the draft
 * `policy.rules` by name — this means the trace renders even if the
 * server hasn't yet populated `blame.expression` for those sources.
 *
 * Returns an empty array when the decision is an unblamed allow, or
 * when every blame is upper-scoped (`system_permission` /
 * `channel_policy` from a non-system editor's view) — the modal
 * intentionally hides expression details for those rows.
 */
function deriveTraces(decision: PolicySimulationActionDecision, action: string, policy?: AccessControlPolicy): DenyTrace[] {
    if (!decision.blame || decision.blame.length === 0) {
        return [];
    }
    const ranked = rankSameScopeBlames(decision.blame);
    const traces: DenyTrace[] = [];
    const seen = new Set<string>();
    for (const blame of ranked) {
        // Dedupe by policy + role so a single policy that denies on
        // multiple roles (rare; usually channel_admin AND channel_user
        // share the same expression) doesn't appear twice. Empty
        // policy_id falls back to source so draft-side blame entries
        // still collapse onto each other when they would otherwise be
        // duplicates of the editing rule.
        const key = `${blame.policy_id ?? ''}|${blame.role ?? ''}|${blame.source}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const trace = buildTraceFromBlame(blame, action, policy);
        if (trace) {
            traces.push(trace);
        }
    }
    return traces;
}

function buildTraceFromBlame(
    blame: PolicySimulationBlame,
    action: string,
    policy?: AccessControlPolicy,
): DenyTrace | null {
    const expression = blame.expression || lookupDraftExpression(blame, policy);
    if (!expression) {
        return null;
    }
    const trace: DenyTrace = {
        expression,
        outcome: blame.outcome === 'allow' ? 'allow' : 'deny',
    };
    if (blame.rule_name) {
        trace.ruleName = blame.rule_name;
    }
    if (blame.role) {
        trace.role = blame.role;
    }

    // Surface the policy name on EVERY blame that points at a peer
    // (or, in the system console, a same-scope system permission)
    // policy — those are the cases where the policy isn't the one the
    // author is editing, so the name disambiguates which contributing
    // policy denied. Draft-side sources stay anonymous: the user IS
    // the policy so repeating the name adds no information.
    if (
        blame.policy_name &&
        blame.source !== POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE &&
        blame.source !== POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE &&
        blame.source !== POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED
    ) {
        trace.policyName = blame.policy_name;
    }

    // Per-rule breakdown for merged expressions: prefer the
    // server-provided `blame.merged_rules` (carries each rule's
    // standalone evaluation tree, computed against the same
    // activation as the merged tree). If the server didn't ship one
    // — older simulator builds, or peer-policy blame where the
    // simulator hasn't yet wired the per-rule fetch — fall back to
    // enumerating the editing draft's rules sharing this (role,
    // action), which is enough to drive the "Combined evaluation"
    // header without numbering individual branches. The fallback can
    // only see the editing draft (we don't ship other policies'
    // rules to the client), so peer-policy blame with no
    // `merged_rules` simply renders without the per-rule numbering.
    if (blame.merged_rules && blame.merged_rules.length > 1) {
        trace.mergedRules = blame.merged_rules.map((m) => ({
            name: m.name,
            expression: m.expression,
            evaluationTree: m.evaluation_tree,
        }));
    } else if (
        blame.role &&
        policy &&
        (
            blame.source === POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE ||
            blame.source === POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE ||
            blame.source === POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED
        )
    ) {
        const merged = (policy.rules ?? []).
            filter((r) => r.role === blame.role && (r.actions ?? []).includes(action)).
            map((r) => ({name: r.name ?? '', expression: r.expression})).
            filter((m) => m.name);
        if (merged.length > 1) {
            trace.mergedRules = merged;
        }
    }

    if (blame.evaluation_tree) {
        trace.evaluationTree = blame.evaluation_tree;
    }
    return trace;
}

type ExpressionTraceNodeProps = {
    node: PolicySimulationEvaluationNode;
};

/**
 * Renders one node in the evaluation tree, recursing into compound
 * children. Compound nodes (and / or / not) render a header line
 * with the operator label and an outcome chip; their children are
 * indented one level via the wrapping `__traceChildren`'s
 * margin-left (no per-component depth tracking — every nesting level
 * compounds the same 12px naturally). Leaf nodes
 * (compare / function / other) render the subtree expression in
 * monospace; FALSE leaves additionally render a single short "Actual:
 * <value>" line so the author sees the user's value at a glance —
 * the expected literal is already visible inside the expression
 * itself, and the attribute path is too, so we don't repeat either.
 * TRUE leaves omit the value strip entirely (the green tick + the
 * expression already convey "matched"); the actual value remains
 * discoverable via the expression code's `title` tooltip.
 *
 * The component is intentionally presentational — no state, no
 * effects — so the same renderer can be reused outside the modal
 * (e.g. for a future "explain rule" tooltip in the editor) without
 * dragging modal-specific props.
 */
function ExpressionTraceNode({node}: ExpressionTraceNodeProps): JSX.Element {
    const isCompound = node.kind === POLICY_SIMULATION_EVALUATION_NODE_KIND.AND ||
        node.kind === POLICY_SIMULATION_EVALUATION_NODE_KIND.OR ||
        node.kind === POLICY_SIMULATION_EVALUATION_NODE_KIND.NOT;

    // FALSE leaves are the only place we surface the actual value
    // inline. TRUE leaves stay quiet, ERROR leaves render their error
    // message instead, compounds delegate to children. Allow nulls
    // through `node.actual_value` so a leaf without a recorded value
    // also stays quiet (e.g. function-call leaves with no LHS
    // attribute).
    const showActualLine = !isCompound &&
        node.outcome === POLICY_SIMULATION_EVALUATION_OUTCOME.FALSE &&
        node.actual_value != null;
    const showError = !isCompound &&
        node.outcome === POLICY_SIMULATION_EVALUATION_OUTCOME.ERROR &&
        Boolean(node.error);

    // Build a "got: X" tooltip on the expression itself so the value
    // is still discoverable on TRUE leaves (where we hide the line)
    // and as supplementary info on FALSE leaves. Use a nullish check
    // so legitimate falsy values (false, 0, '') still surface in the
    // tooltip — only null/undefined should suppress it.
    const expressionTitle = node.actual_value == null ? undefined : `actual: ${node.actual_value}`;

    return (
        <div
            className={classNames(
                'SimulateAccessModal__traceNode',
                outcomeClass(node.outcome),
                {'SimulateAccessModal__traceNode--compound': isCompound},
            )}
            data-testid={`simulate-access-trace-node-${node.kind}-${node.outcome}`}
        >
            <div className='SimulateAccessModal__traceHeader'>
                <OutcomeIcon outcome={node.outcome}/>
                {isCompound ? (
                    <span className='SimulateAccessModal__traceCompoundLabel'>
                        <CompoundLabel kind={node.kind}/>
                    </span>
                ) : (
                    <code
                        className='SimulateAccessModal__traceExpression'
                        title={expressionTitle}
                    >
                        {node.expression}
                    </code>
                )}
            </div>
            {showError ? (
                <div className='SimulateAccessModal__traceError'>{node.error}</div>
            ) : null}
            {showActualLine ? (
                <div className='SimulateAccessModal__traceValues'>
                    <span className='SimulateAccessModal__traceActual'>
                        <FormattedMessage
                            id='admin.access_control.simulate_access.details.trace.actual'
                            defaultMessage='Actual: {value}'
                            values={{value: node.actual_value}}
                        />
                    </span>
                </div>
            ) : null}
            {isCompound && node.children ? (
                <div className='SimulateAccessModal__traceChildren'>
                    {node.children.map((child, idx) => (
                        <ExpressionTraceNode
                            key={`${node.kind}-${idx}`}
                            node={child}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function outcomeClass(outcome: string): string {
    switch (outcome) {
    case POLICY_SIMULATION_EVALUATION_OUTCOME.TRUE:
        return 'SimulateAccessModal__traceNode--true';
    case POLICY_SIMULATION_EVALUATION_OUTCOME.FALSE:
        return 'SimulateAccessModal__traceNode--false';
    case POLICY_SIMULATION_EVALUATION_OUTCOME.ERROR:
        return 'SimulateAccessModal__traceNode--error';
    default:
        return '';
    }
}

type OutcomeIconProps = {outcome: string};

function OutcomeIcon({outcome}: OutcomeIconProps): JSX.Element {
    switch (outcome) {
    case POLICY_SIMULATION_EVALUATION_OUTCOME.TRUE:
        return (
            <i
                className='icon icon-check-circle SimulateAccessModal__traceIcon SimulateAccessModal__traceIcon--true'
                aria-hidden='true'
            />
        );
    case POLICY_SIMULATION_EVALUATION_OUTCOME.FALSE:
        return (
            <i
                className='icon icon-close-circle SimulateAccessModal__traceIcon SimulateAccessModal__traceIcon--false'
                aria-hidden='true'
            />
        );
    case POLICY_SIMULATION_EVALUATION_OUTCOME.ERROR:
    default:
        return (
            <i
                className='icon icon-alert-circle-outline SimulateAccessModal__traceIcon SimulateAccessModal__traceIcon--error'
                aria-hidden='true'
            />
        );
    }
}

type CompoundLabelProps = {kind: string};

function CompoundLabel({kind}: CompoundLabelProps): JSX.Element {
    switch (kind) {
    case POLICY_SIMULATION_EVALUATION_NODE_KIND.AND:
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.details.trace.and'
                defaultMessage='ALL of the following must hold (AND)'
            />
        );
    case POLICY_SIMULATION_EVALUATION_NODE_KIND.OR:
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.details.trace.or'
                defaultMessage='ANY of the following may hold (OR)'
            />
        );
    case POLICY_SIMULATION_EVALUATION_NODE_KIND.NOT:
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.details.trace.not'
                defaultMessage='NONE of the following may hold (NOT)'
            />
        );
    default:
        // A new compound kind landed on the server but the UI hasn't
        // been taught about it yet. Render a generic label so the
        // trace doesn't lie ("NONE…" used to be the silent fallback)
        // and warn loudly so a developer notices in dev builds.
        // eslint-disable-next-line no-console
        console.warn('CompoundLabel: unknown evaluation node kind', kind);
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.details.trace.unknown'
                defaultMessage='Unknown compound evaluation'
            />
        );
    }
}

// Source-priority order when ranking blame entries: lower index wins.
// Only same-scope sources appear here — the modal does not surface
// upper-scoped blame, so we don't rank `system_permission` /
// `channel_policy`.
const SAME_SCOPE_SOURCE_PRIORITY: string[] = [
    POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
    POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE,
    POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED,
    POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
];

// rankSameScopeBlames returns the same-scope subset of `blame` sorted
// by SAME_SCOPE_SOURCE_PRIORITY (this_rule first, peer_policy last).
// Entries whose source is upper-scoped (`system_permission` /
// `channel_policy` from a non-system editor's view, after the
// public-server's privacy classification) are filtered out — the
// modal never surfaces those. Stable for entries with the same
// priority so the response order is preserved (it matches the
// simulator's contribution order, which keeps the picker visually
// consistent run-to-run).
function rankSameScopeBlames(blame: PolicySimulationBlame[]): PolicySimulationBlame[] {
    type Indexed = {blame: PolicySimulationBlame; rank: number; index: number};
    const indexed: Indexed[] = [];
    for (let i = 0; i < blame.length; i++) {
        const b = blame[i];
        const rank = SAME_SCOPE_SOURCE_PRIORITY.indexOf(b.source);
        if (rank === -1) {
            continue;
        }
        indexed.push({blame: b, rank, index: i});
    }
    indexed.sort((a, b) => (a.rank - b.rank) || (a.index - b.index));
    return indexed.map((entry) => entry.blame);
}

function lookupDraftExpression(blame: PolicySimulationBlame, policy?: AccessControlPolicy): string {
    if (!policy || !blame.rule_name) {
        return '';
    }
    if (
        blame.source !== POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE &&
        blame.source !== POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE &&
        blame.source !== POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED
    ) {
        return '';
    }
    const match = policy.rules?.find((r) => r.name === blame.rule_name);
    return match?.expression ?? '';
}
