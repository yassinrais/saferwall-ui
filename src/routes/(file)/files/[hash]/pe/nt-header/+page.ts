import { APIClient } from '$lib/api';
import type { PageLoad } from './$types';

export const load = (async ({ params, parent }): Promise<{
    ntHeader: any
}> => {
    const { hash } = params;

    const { pe } = await APIClient.request<APIFile>(`files/${hash}?fields=pe.nt_header`);

    const signature = pe.nt_header?.Signature;
    if (signature) {
        pe.nt_header.FileHeader.Signature = signature;
        delete pe.nt_header?.Signature;
    }

    const dataDirectory = pe.nt_header?.OptionalHeader?.DataDirectory;
    if (dataDirectory) {
        pe.nt_header.DataDirectory = dataDirectory;
        delete pe.nt_header?.OptionalHeader?.DataDirectory;
    }

    return {
        ntHeader: pe.nt_header
    };

}) satisfies PageLoad;