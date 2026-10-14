// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PolicySimulationActionDecision} from '@mattermost/types/access_control';

// `download_file_attachment` decisions captured from a real `/cel/simulate_users` response
// (masking on, "All policies", a peer policy denying the person and the bot with the attribute).

// simulate_maskon_single_all_peerdeny.json, qa3-human
export const SINGLE_RULE_PERSON: PolicySimulationActionDecision = {
    decision: false,
    blame: [
        {
            source: 'peer_policy',
            outcome: 'deny',
            policy_id: '63k3xgfp1i86fqj7b1ywspi17w',
            policy_name: 'QA3-BotScope-bfbcf6',
            role: 'system_user',
            expression: '(user.id != "kx16gqtbdtbe8bzcagnrsogfzo") && (user.id != "6zi4u35cztfeiqjbct8th1h3eh")',
            evaluation_tree: {
                kind: 'and',
                expression: '(user.id != "kx16gqtbdtbe8bzcagnrsogfzo") && (user.id != "6zi4u35cztfeiqjbct8th1h3eh")',
                outcome: 'false',
                children: [
                    {
                        kind: 'compare',
                        expression: 'user.id != "kx16gqtbdtbe8bzcagnrsogfzo"',
                        outcome: 'false',
                        operator: '!=',
                        attribute: 'user.id',
                        actual_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                        expected_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                    },
                    {
                        kind: 'compare',
                        expression: 'user.id != "6zi4u35cztfeiqjbct8th1h3eh"',
                        outcome: 'true',
                        operator: '!=',
                        attribute: 'user.id',
                        actual_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                        expected_value: '6zi4u35cztfeiqjbct8th1h3eh',
                    },
                ],
            },
        },
        {
            source: 'this_rule',
            outcome: 'allow',
            policy_id: 'c4zu65negfr5zes9ap6qhegbyh',
            policy_name: 'QA3-Draft',
            role: 'system_user',
            expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
            evaluation_tree: {
                kind: 'or',
                expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
                outcome: 'true',
                children: [
                    {
                        kind: 'not',
                        expression: '!(user.isbot)',
                        outcome: 'true',
                        children: [
                            {
                                kind: 'other',
                                expression: 'user.isbot',
                                outcome: 'false',
                            },
                        ],
                    },
                    {
                        kind: 'compare',
                        expression: 'user.attributes.QA3Clearance == "Secret"',
                        outcome: 'error',
                        error: 'no such key: QA3Clearance',
                        operator: '==',
                        attribute: 'user.attributes.QA3Clearance',
                        expected_value: 'Secret',
                    },
                ],
            },
        },
    ],
};

// simulate_maskon_single_all_peerdeny.json, qa3-botwith
export const SINGLE_RULE_BOT_WITH_ATTRIBUTE: PolicySimulationActionDecision = {
    decision: false,
    blame: [
        {
            source: 'peer_policy',
            outcome: 'deny',
            policy_id: '63k3xgfp1i86fqj7b1ywspi17w',
            policy_name: 'QA3-BotScope-bfbcf6',
            role: 'system_user',
            expression: '(user.id != "kx16gqtbdtbe8bzcagnrsogfzo") && (user.id != "6zi4u35cztfeiqjbct8th1h3eh")',
            evaluation_tree: {
                kind: 'and',
                expression: '(user.id != "kx16gqtbdtbe8bzcagnrsogfzo") && (user.id != "6zi4u35cztfeiqjbct8th1h3eh")',
                outcome: 'false',
                children: [
                    {
                        kind: 'compare',
                        expression: 'user.id != "kx16gqtbdtbe8bzcagnrsogfzo"',
                        outcome: 'true',
                        operator: '!=',
                        attribute: 'user.id',
                        actual_value: '6zi4u35cztfeiqjbct8th1h3eh',
                        expected_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                    },
                    {
                        kind: 'compare',
                        expression: 'user.id != "6zi4u35cztfeiqjbct8th1h3eh"',
                        outcome: 'false',
                        operator: '!=',
                        attribute: 'user.id',
                        actual_value: '6zi4u35cztfeiqjbct8th1h3eh',
                        expected_value: '6zi4u35cztfeiqjbct8th1h3eh',
                    },
                ],
            },
        },
        {
            source: 'this_rule',
            outcome: 'allow',
            policy_id: 'c4zu65negfr5zes9ap6qhegbyh',
            policy_name: 'QA3-Draft',
            role: 'system_user',
            expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
            evaluation_tree: {
                kind: 'or',
                expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
                outcome: 'true',
                children: [
                    {
                        kind: 'not',
                        expression: '!(user.isbot)',
                        outcome: 'false',
                        children: [
                            {
                                kind: 'other',
                                expression: 'user.isbot',
                                outcome: 'true',
                            },
                        ],
                    },
                    {
                        kind: 'compare',
                        expression: 'user.attributes.QA3Clearance == "Secret"',
                        outcome: 'true',
                        operator: '==',
                        attribute: 'user.attributes.QA3Clearance',
                        actual_value: 'Secret',
                        expected_value: 'Secret',
                    },
                ],
            },
        },
    ],
};

// simulate_maskon_single_all_peerdeny.json, qa3-botwithout
export const SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE: PolicySimulationActionDecision = {
    decision: false,
    blame: [
        {
            source: 'this_rule',
            outcome: 'deny',
            policy_id: 'c4zu65negfr5zes9ap6qhegbyh',
            policy_name: 'QA3-Draft',
            role: 'system_user',
            expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
            evaluation_tree: {
                kind: 'or',
                expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
                outcome: 'error',
                children: [
                    {
                        kind: 'not',
                        expression: '!(user.isbot)',
                        outcome: 'false',
                        children: [
                            {
                                kind: 'other',
                                expression: 'user.isbot',
                                outcome: 'true',
                            },
                        ],
                    },
                    {
                        kind: 'compare',
                        expression: 'user.attributes.QA3Clearance == "Secret"',
                        outcome: 'error',
                        error: 'no such key: QA3Clearance',
                        operator: '==',
                        attribute: 'user.attributes.QA3Clearance',
                        expected_value: 'Secret',
                    },
                ],
            },
        },
    ],
};

// simulate_maskon_fold2_all_peerdeny.json, qa3-human
export const TWO_RULE_FOLD_PERSON: PolicySimulationActionDecision = {
    decision: false,
    blame: [
        {
            source: 'peer_policy',
            outcome: 'deny',
            policy_id: '63k3xgfp1i86fqj7b1ywspi17w',
            policy_name: 'QA3-BotScope-bfbcf6',
            role: 'system_user',
            expression: '(user.id != "kx16gqtbdtbe8bzcagnrsogfzo") && (user.id != "6zi4u35cztfeiqjbct8th1h3eh")',
            evaluation_tree: {
                kind: 'and',
                expression: '(user.id != "kx16gqtbdtbe8bzcagnrsogfzo") && (user.id != "6zi4u35cztfeiqjbct8th1h3eh")',
                outcome: 'false',
                children: [
                    {
                        kind: 'compare',
                        expression: 'user.id != "kx16gqtbdtbe8bzcagnrsogfzo"',
                        outcome: 'false',
                        operator: '!=',
                        attribute: 'user.id',
                        actual_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                        expected_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                    },
                    {
                        kind: 'compare',
                        expression: 'user.id != "6zi4u35cztfeiqjbct8th1h3eh"',
                        outcome: 'true',
                        operator: '!=',
                        attribute: 'user.id',
                        actual_value: 'kx16gqtbdtbe8bzcagnrsogfzo',
                        expected_value: '6zi4u35cztfeiqjbct8th1h3eh',
                    },
                ],
            },
        },
        {
            source: 'this_rule',
            outcome: 'allow',
            policy_id: 'oxxuwhn9ht8b7p77ek97rzzuaw',
            policy_name: 'QA3-Draft',
            role: 'system_user',
            expression: '((!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")) || ((!(user.isbot)) || (user.attributes.QA3Clearance == "TopSecret"))',
            evaluation_tree: {
                kind: 'or',
                expression: '((!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")) || ((!(user.isbot)) || (user.attributes.QA3Clearance == "TopSecret"))',
                outcome: 'true',
                children: [
                    {
                        kind: 'or',
                        expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
                        outcome: 'true',
                        children: [
                            {
                                kind: 'not',
                                expression: '!(user.isbot)',
                                outcome: 'true',
                                children: [
                                    {
                                        kind: 'other',
                                        expression: 'user.isbot',
                                        outcome: 'false',
                                    },
                                ],
                            },
                            {
                                kind: 'compare',
                                expression: 'user.attributes.QA3Clearance == "Secret"',
                                outcome: 'error',
                                error: 'no such key: QA3Clearance',
                                operator: '==',
                                attribute: 'user.attributes.QA3Clearance',
                                expected_value: 'Secret',
                            },
                        ],
                    },
                    {
                        kind: 'or',
                        expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "TopSecret")',
                        outcome: 'true',
                        children: [
                            {
                                kind: 'not',
                                expression: '!(user.isbot)',
                                outcome: 'true',
                                children: [
                                    {
                                        kind: 'other',
                                        expression: 'user.isbot',
                                        outcome: 'false',
                                    },
                                ],
                            },
                            {
                                kind: 'compare',
                                expression: 'user.attributes.QA3Clearance == "TopSecret"',
                                outcome: 'error',
                                error: 'no such key: QA3Clearance',
                                operator: '==',
                                attribute: 'user.attributes.QA3Clearance',
                                expected_value: 'TopSecret',
                            },
                        ],
                    },
                ],
            },
        },
    ],
};

// simulate_maskon_fold2_all_peerdeny.json, qa3-botwithout
export const TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE: PolicySimulationActionDecision = {
    decision: false,
    blame: [
        {
            source: 'this_rule',
            outcome: 'deny',
            policy_id: 'oxxuwhn9ht8b7p77ek97rzzuaw',
            policy_name: 'QA3-Draft',
            role: 'system_user',
            expression: '((!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")) || ((!(user.isbot)) || (user.attributes.QA3Clearance == "TopSecret"))',
            evaluation_tree: {
                kind: 'or',
                expression: '((!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")) || ((!(user.isbot)) || (user.attributes.QA3Clearance == "TopSecret"))',
                outcome: 'error',
                children: [
                    {
                        kind: 'or',
                        expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "Secret")',
                        outcome: 'error',
                        children: [
                            {
                                kind: 'not',
                                expression: '!(user.isbot)',
                                outcome: 'false',
                                children: [
                                    {
                                        kind: 'other',
                                        expression: 'user.isbot',
                                        outcome: 'true',
                                    },
                                ],
                            },
                            {
                                kind: 'compare',
                                expression: 'user.attributes.QA3Clearance == "Secret"',
                                outcome: 'error',
                                error: 'no such key: QA3Clearance',
                                operator: '==',
                                attribute: 'user.attributes.QA3Clearance',
                                expected_value: 'Secret',
                            },
                        ],
                    },
                    {
                        kind: 'or',
                        expression: '(!(user.isbot)) || (user.attributes.QA3Clearance == "TopSecret")',
                        outcome: 'error',
                        children: [
                            {
                                kind: 'not',
                                expression: '!(user.isbot)',
                                outcome: 'false',
                                children: [
                                    {
                                        kind: 'other',
                                        expression: 'user.isbot',
                                        outcome: 'true',
                                    },
                                ],
                            },
                            {
                                kind: 'compare',
                                expression: 'user.attributes.QA3Clearance == "TopSecret"',
                                outcome: 'error',
                                error: 'no such key: QA3Clearance',
                                operator: '==',
                                attribute: 'user.attributes.QA3Clearance',
                                expected_value: 'TopSecret',
                            },
                        ],
                    },
                ],
            },
        },
    ],
};
