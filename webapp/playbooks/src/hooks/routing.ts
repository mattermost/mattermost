import {useEffect, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PresetTemplates} from 'src/components/templates/template_data';
import {DraftPlaybookWithChecklist, Playbook, emptyPlaybook} from 'src/types/playbook';
import {PlaybookRole} from 'src/types/permissions';
import {savePlaybook} from 'src/client';
import {navigateToPluginUrl, pluginUrl} from 'src/browser_routing';
import {PlaybookLhsDocument} from 'src/graphql/generated/graphql';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';

type PlaybooksRoutingOptions<T> = {
    urlOnly?: boolean,
    onGo?: (arg: T) => void
}

export type PlaybookCreateQueryParameters = {
    teamId?: string,
    name?: string,
    template?: string,
    description?: string,
    public?: boolean
}

function id(p: Playbook | Playbook['id']) {
    return p && typeof p !== 'string' ? p.id : p;
}

/**
 * Access backstage routing functions for a given team.
 * @typeParam T - Type of routing function parameter and argument in callback. Must be {@link Playbook} or {@link Playbook.id}.
 * @param options - {@link PlaybooksRoutingOptions} alters behavior of hook
 *
 * @example Get URL to go view the given playbook
 * const {view} = usePlaybooksRouting({urlOnly: true});
 * const url = view(id);
 *
 * @example Navigate to the backstage edit page for the given playbook
 * const playbookRouting = usePlaybooksRouting();
 * playbookRouting.edit(id);
 */
export function usePlaybooksRouting<TParam extends Playbook | Playbook['id']>(
    {urlOnly, onGo}: PlaybooksRoutingOptions<TParam> = {},
) {
    const currentUserId = useSelector(getCurrentUserId);

    return useMemo(() => {
        function go(path: string, p?: TParam) {
            if (!urlOnly) {
                if (p) {
                    onGo?.(p);
                }
                navigateToPluginUrl(path);
            }

            return pluginUrl(path);
        }

        return {
            edit: (p: TParam) => {
                return go(`/playbooks/${id(p)}/outline`, p);
            },
            view: (p: TParam) => {
                return go(`/playbooks/${id(p)}`, p);
            },
            create: async (params: PlaybookCreateQueryParameters) => {
                const createNewPlaybook = async () => {
                    const initialPlaybook: DraftPlaybookWithChecklist = {
                        ...(PresetTemplates.find((t) => t.title === params.template)?.template || emptyPlaybook()),
                        reminder_timer_default_seconds: 86400,
                        members: [{user_id: currentUserId, roles: [PlaybookRole.Member, PlaybookRole.Admin]}],
                        team_id: params.teamId || '',
                    };

                    if (params.name) {
                        initialPlaybook.title = params.name;
                    }
                    if (params.description) {
                        initialPlaybook.description = params.description;
                    }
                    if (!initialPlaybook.title) {
                        initialPlaybook.title = 'Untitled Playbook';
                    }

                    initialPlaybook.public = Boolean(params.public);

                    const data = await savePlaybook(initialPlaybook);
                    getPlaybooksGraphQLClient().refetchQueries({
                        include: [PlaybookLhsDocument],
                    });
                    return data?.id;
                };

                const playbookId = await createNewPlaybook();
                return go(`/playbooks/${playbookId}/outline`);
            },
        };
    }, [onGo, urlOnly]);
}

const selectSiteName = (state: GlobalState) => getConfig(state).SiteName;

export function useForceDocumentTitle(title: string) {
    const siteName = useSelector(selectSiteName);

    // Restore original title
    useEffect(() => {
        const original = document.title;
        return () => {
            document.title = original;
        };
    }, []);

    // Update title
    useEffect(() => {
        document.title = title + ' - ' + siteName;
    }, [title, siteName]);
}
