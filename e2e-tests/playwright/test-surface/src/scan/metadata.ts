// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import {cmp, cmpLoc} from '../compare.ts';
import {relativeToRoot, type Config} from '../config.ts';
import {KEY_PLACEHOLDER} from '../grammar.ts';
import {type Manifest, type PluginInfo, type PluginSlot} from '../manifest_types.ts';
import {installedVersion, packageDir, type PublishedParts} from '../parts.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** Describe installed part libraries and the configured host or plugin slot contracts. */
export class ScanMetadata {
    private readonly context: {ix: ProgramIndex; config: Config; published: PublishedParts[]};
    constructor(context: {ix: ProgramIndex; config: Config; published: PublishedParts[]}) {
        this.context = context;
    }

    /** The configured component libraries as installed: version, and whether their parts were read. */
    libraries(): NonNullable<Manifest['generatedFrom']['libraries']> {
        return this.context.config.libraries.map((lib) => {
            if (typeof lib !== 'string') {
                // parts from a file the config names: the file stands for the version
                return {package: lib.package, version: relativeToRoot(this.context.config, path.resolve(this.context.config.root, lib.parts)), parts: this.context.published.some((p) => p.package === lib.package)};
            }
            const dir = packageDir(this.context.config.root, lib);
            return {package: lib, version: dir ? installedVersion(dir) : 'not installed', parts: this.context.published.some((p) => p.package === lib)};
        });
    }

    /** The published slot contract: `export const X = {slot: 'template with {plugin}', …} as const`, and the registry methods that fill each slot. */
    pluginSlots(): PluginSlot[] {
        const c = this.context.config.pluginSlots;
        if (!c) {
            return [];
        }
        return Object.entries(c).sort((a, b) => cmp(a[0], b[0])).map(([slot, declaration]) => ({
            slot,
            template: declaration.template.replace('{key}', KEY_PLACEHOLDER),
            ...(declaration.registry?.length ? {registry: [...declaration.registry].sort(cmp)} : {}),
            at: relativeToRoot(this.context.config, this.context.config.configPath),
        }));
    }

    /**
     * Plugin mode: the host slots the plugin's registry calls fill (`registry.registerChannelHeaderMenuAction(…)`
     * fills `channel_header_menu_item`), from the registry methods each supported host's app map lists.
     */
    pluginInfo(): PluginInfo {
        const plugin = this.context.config.plugin!;
        const slotsByMethod = new Map<string, Set<string>>();
        for (const [slot, declaration] of Object.entries(plugin.slotContract)) {
            for (const method of declaration.registry ?? []) {
                slotsByMethod.set(method, (slotsByMethod.get(method) ?? new Set()).add(slot));
            }
        }
        const slotsUsed: PluginInfo['slotsUsed'] = [];

        // a registry call is a call on the registry's type (an untyped registry counts: nothing better is known)
        const onRegistry = (receiver: ts.Expression) => {
            const t = this.context.ix.checker.getNonNullableType(this.context.ix.checker.getTypeAtLocation(receiver));
            return Boolean(t.flags & typescript.TypeFlags.Any) || (t.aliasSymbol ?? t.getSymbol())?.getName() === plugin.registryType;
        };
        const visit = (n: ts.Node) => {
            if (typescript.isCallExpression(n) && typescript.isPropertyAccessExpression(n.expression)) {
                const slots = slotsByMethod.get(n.expression.name.text);
                if (slots && onRegistry(n.expression.expression)) {
                    slotsUsed.push({method: n.expression.name.text, slots: [...slots].sort(), at: this.context.ix.where(n)});
                }
            }
            typescript.forEachChild(n, visit);
        };
        for (const sf of this.context.ix.files) {
            visit(sf);
        }
        return {id: plugin.id, key: plugin.key, scope: plugin.scope, slotsUsed: slotsUsed.sort((a, b) => cmpLoc(a.at, b.at))};
    }
}
