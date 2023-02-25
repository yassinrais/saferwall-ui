import { APIClient } from '$lib/api';
import type { PageLoad } from './$types';

export const load = (async ({ params, parent }): Promise<{
    sections: any
}> => {
    const { hash } = params;

    const { pe } = await APIClient.request<APIFile>(`files/${hash}?fields=pe.sections`);

    return {
        sections: pe.sections
    };

}) satisfies PageLoad;