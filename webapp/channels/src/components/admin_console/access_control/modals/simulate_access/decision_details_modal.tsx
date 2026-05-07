// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
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

    const hasUserAttrs = userAttributes && Object.keys(userAttributes).length > 0;
    const hasSessionAttrs = sessionAttributes && Object.keys(sessionAttributes).length > 0;

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

            {(hasUserAttrs || hasSessionAttrs) ? (
                <div
                    className='SimulateAccessModal__detailsAttributes'
                    data-testid='simulate-access-details-attributes'
                >
                    {hasUserAttrs ? (
                        <AttributeSection
                            heading={
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.details.user_attributes'
                                    defaultMessage='User attributes'
                                />
                            }
                            values={userAttributes!}
                            testId='simulate-access-details-user-attributes'
                        />
                    ) : null}
                    {hasSessionAttrs ? (
                        <AttributeSection
                            heading={
                                <FormattedMessage
                                    id='admin.access_control.simulate_access.details.session_attributes'
                                    defaultMessage='Session attributes'
                                />
                            }
                            values={sessionAttributes!}
                            testId='simulate-access-details-session-attributes'
                        />
                    ) : null}
                </div>
            ) : null}

            <ul className='SimulateAccessModal__detailsList'>
                {actions.map((action) => {
                    const dec = decisions?.[action];
                    const trace = !pending && dec ? deriveTrace(dec, policy) : null;
                    return (
                        <ActionDetailsRow
                            key={action}
                            action={action}
                            label={actionLabels?.[action] ?? action}
                            decision={dec}
                            pending={pending}
                            trace={trace}
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
    trace: DenyTrace | null;
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
function ActionDetailsRow({action, label, decision, pending, trace}: ActionDetailsRowProps): JSX.Element {
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
            {trace ? (
                <>
                    <button
                        type='button'
                        className='SimulateAccessModal__detailsToggle'
                        data-testid={`simulate-access-details-toggle-${action}`}
                        aria-expanded={showDetails}
                        aria-controls={`simulate-access-details-rule-${action}`}
                        onClick={() => setShowDetails((s) => !s)}
                    >
                        <i
                            className={classNames('icon', {
                                'icon-chevron-down': !showDetails,
                                'icon-chevron-up': showDetails,
                            })}
                            aria-hidden='true'
                        />
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
                    </button>
                    {showDetails ? (
                        <div
                            id={`simulate-access-details-rule-${action}`}
                            className='SimulateAccessModal__detailsRule'
                            data-testid={`simulate-access-details-rule-${action}`}
                        >
                            {trace.policyName ? (
                                <div className='SimulateAccessModal__detailsPolicy'>
                                    <FormattedMessage
                                        id='admin.access_control.simulate_access.details.policy_label'
                                        defaultMessage='Policy: {name}'
                                        values={{name: trace.policyName}}
                                    />
                                </div>
                            ) : null}
                            {trace.ruleName ? (
                                <div className='SimulateAccessModal__detailsRuleName'>
                                    <FormattedMessage
                                        id='admin.access_control.simulate_access.details.rule_label'
                                        defaultMessage='Rule: {name}'
                                        values={{name: trace.ruleName}}
                                    />
                                </div>
                            ) : null}
                            {trace.evaluationTree ? (
                                <div
                                    className='SimulateAccessModal__detailsTree'
                                    data-testid={`simulate-access-details-tree-${action}`}
                                >
                                    <ExpressionTraceNode node={trace.evaluationTree}/>
                                </div>
                            ) : (
                                <code className='SimulateAccessModal__detailsExpression'>
                                    {trace.expression}
                                </code>
                            )}
                        </div>
                    ) : null}
                </>
            ) : null}
        </li>
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

    /** Per-node evaluation breakdown of the failing rule, when the
     *  server attached one. Renders as a structured AND/OR/NOT tree
     *  with outcome coloring; absent → fall back to flat
     *  expression text. */
    evaluationTree?: PolicySimulationEvaluationNode;
};

/**
 * Returns the rule + expression (and optional evaluation tree) to
 * surface for a decision when the blame is at the draft's own scope.
 * For draft-side blame (`this_rule`/`sibling_rule`/`sibling_saved`) we
 * fall back to looking up the expression in the draft `policy.rules`
 * by name — this means the trace renders even if the server hasn't
 * yet populated `blame.expression` for those sources.
 *
 * Returns null when the decision is an unblamed allow, or when blame
 * is upper-scoped (`system_permission`, `channel_policy`) — the modal
 * intentionally hides expression details for those rows.
 */
function deriveTrace(decision: PolicySimulationActionDecision, policy?: AccessControlPolicy): DenyTrace | null {
    if (!decision.blame || decision.blame.length === 0) {
        return null;
    }
    const blame = pickPrimaryBlame(decision.blame);
    if (!blame) {
        return null;
    }
    const expression = blame.expression || lookupDraftExpression(blame, policy);
    if (!expression) {
        return null;
    }
    const trace: DenyTrace = {expression};
    if (blame.rule_name) {
        trace.ruleName = blame.rule_name;
    }

    // For peer-policy blame the policy name disambiguates which sibling
    // policy denied. For draft-side sources the user is editing the
    // policy so we don't need to repeat its name.
    if (blame.source === POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY && blame.policy_name) {
        trace.policyName = blame.policy_name;
    }

    // Forward the AST evaluation breakdown when the server attached
    // one. The tree's privacy contract (only populated for same-scope
    // sources) matches `expression`, so we don't need an extra source
    // check here.
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
        Boolean(node.actual_value);
    const showError = !isCompound &&
        node.outcome === POLICY_SIMULATION_EVALUATION_OUTCOME.ERROR &&
        Boolean(node.error);

    // Build a "got: X" tooltip on the expression itself so the value
    // is still discoverable on TRUE leaves (where we hide the line)
    // and as supplementary info on FALSE leaves.
    const expressionTitle = node.actual_value ? `actual: ${node.actual_value}` : undefined;

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

function pickPrimaryBlame(blame: PolicySimulationBlame[]): PolicySimulationBlame | undefined {
    let best: PolicySimulationBlame | undefined;
    let bestRank = SAME_SCOPE_SOURCE_PRIORITY.length;
    for (const b of blame) {
        const rank = SAME_SCOPE_SOURCE_PRIORITY.indexOf(b.source);
        if (rank === -1) {
            continue;
        }
        if (rank < bestRank) {
            best = b;
            bestRank = rank;
        }
    }
    return best;
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
