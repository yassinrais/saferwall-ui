import { env } from '$env/dynamic/public';
import { DEFAULT_PAGINATION_ITEMS } from '$lib/config';
import type {
	ApiTraceBufferDto,
	ChangePasswordDto,
	LoginDto,
	Pagination,
	RegisterDto,
	Saferwall,
	UpdateEmailDto,
	UpdatePasswordDto,
	UpdateProfileDto
} from '$lib/types';

export class SaferwallClient {
	private authorization?: string;

	private config: Saferwall.Config = {
		url: `${env.PUBLIC_API_URL}`,
		artifactsUrl: `${env.PUBLIC_ARTIFACTS_URL}`
	};

	private get isLoggedIn(): boolean {
		return this.authorization !== undefined;
	}

	constructor(session?: Saferwall.Session) {
		if (session && session.token) {
			this.authorization = `Bearer ${session.token}`;
		}
	}

	public async request<T>(endpoint: string, args: RequestInit = {}, toJson = true): Promise<T> {
		const url = `${endpoint.startsWith('https://') ? '' : this.config.url}${endpoint}`;
		const init: RequestInit = {
			headers: {
				'Content-Type': 'application/json',
				...(args.headers ?? {})
			},
			...args
		};

		const response: any = await fetch(url, this.setAuthHeaders(init));

		if (!response.ok) {
			throw response;
		}

		if (toJson) {
			return response.json();
		}

		return response;
	}

	public async getActivities(pagination?: Pagination) {
		return this.request<Saferwall.Pagination<Saferwall.Activity>>(
			`users/activities` + this.generatePaginateQuery(pagination)
		);
	}

	public async getUserSectionItems<T>(username: string, section: string, pagination?: Pagination) {
		return this.request<Saferwall.Pagination<T>>(
			`users/${username}/${section}` + this.generatePaginateQuery(pagination)
		);
	}

	public async getFileStatus(hash: string): Promise<number> {
		return this.request<{ status: number }>(`files/${hash}?fields=status`).then(
			(res) => res.status
		);
	}

	public async uploadFile(file: File): Promise<Saferwall.File> {
		const data: any = new FormData();
		data.append('file', file);

		return this.request<Saferwall.File>(`files/`, {
			method: 'POST',
			headers: {
				'Content-Length': `${file.size}`
			},
			body: data
		});
	}

	public async getFile(hash: string) {
		return this.request<Saferwall.File>(`files/${hash}`);
	}

	public async getFileMeta(hash: string) {
		return this.request<Saferwall.File>(
			`files/${hash}?fields=first_seen,submissions,sha256,last_scanned,multiav,file_format,pe.meta`
		);
	}

	public async getFileSummary(hash: string) {
		return this.request<Saferwall.File & Saferwall.Summary>(`files/${hash}/summary`);
	}

	public async getFileApiTrace(
		behaviorId: string,
		pagination?: Pagination & Partial<{ pid: string[] }>
	) {
		return this.request<Saferwall.Pagination<Saferwall.Behaviors.ApiTrace.Item>>(
			`behaviors/${behaviorId}/api-trace` + this.generatePaginateQuery(pagination)
		);
	}

	public async getBahviorScreenshots(
		hash: string,
		behaviorId: string
	): Promise<Saferwall.Screenshots> {
		return this.request<{ screenshots_count: number }>(
			`behaviors/${behaviorId}/?fields=screenshots_count`
		).then((res) =>
			Array(res.screenshots_count || 0)
				.fill(null)
				.map((_, index) => {
					return {
						preview: `${this.config.artifactsUrl}${hash}/${behaviorId}/screenshots/${index}.min.jpeg`,
						original: `${this.config.artifactsUrl}${hash}/${behaviorId}/screenshots/${index}.jpeg`
					};
				})
		);
	}

	public async getFileProcessTree(behaviorId: string) {
		return this.request<{ proc_tree: Saferwall.Behaviors.ProcessItem[] }>(
			`behaviors/${behaviorId}?fields=proc_tree`
		).then((res) => res.proc_tree ?? []);
	}

	public async getFileSystemEvents(behaviorId: string, pid?: string) {
		const params = new URLSearchParams();
		if (pid) {
			params.append('pid', pid);
		}

		return this.request<Saferwall.Pagination<Saferwall.Behaviors.SystemEvent>>(
			`behaviors/${behaviorId}/sys-events${(params && '?' + params.toString()) || ''}`
		).then((res) => res.items ?? []);
	}

	public async getBehaviorArtifcats(behaviorId: string, pagination?: Pagination) {
		return this.request<Saferwall.Pagination<Saferwall.Behaviors.Artifcats>>(
			`behaviors/${behaviorId}/artifacts` + this.generatePaginateQuery(pagination)
		);
	}

	// TODO: (API) Implement pid filtering
	public async getFileCapabilities(behaviorId: string, pid?: string) {
		const params = new URLSearchParams();
		if (pid) {
			params.append('pid', pid);
		}

		return this.request<{ capabilities: Saferwall.Behaviors.Capability[] }>(
			`behaviors/${behaviorId}?fields=capabilities`
		).then((res) => res.capabilities ?? []);
	}

	public async getFileBuffData({
		hash,
		behaviorId,
		procName,
		pid,
		tid,
		buffId
	}: ApiTraceBufferDto) {
		return this.request<Response>(
			`${this.config.artifactsUrl}${hash}/${behaviorId}/api-buffers/${procName}__${pid}__${tid}__${buffId}.buff`,
			{
				headers: {}
			},
			false
		).then((res) => res.arrayBuffer());
	}
	public async rescanFile(hash: string) {
		return this.request<unknown>(`files/${hash}/rescan`, {
			method: 'POST'
		});
	}

	public async getUser(username: string) {
		return this.request<Saferwall.User>(`users/${username}`);
	}

	public async followUser(username: string, follow: boolean = true) {
		const type = follow ? 'follow' : 'unfollow';

		return this.request<unknown>(`users/${username}/${type}`, {
			method: 'POST'
		});
	}

	public async likeFile(hash: string, like: boolean = true) {
		const type = like ? 'like' : 'unlike';

		return this.request<unknown>(`files/${hash}/${type}`, {
			method: 'POST'
		});
	}

	public async singIn(data: LoginDto) {
		return this.request<Saferwall.Session>('auth/login', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	public async signUp(data: RegisterDto) {
		return this.request<Saferwall.Session>('users/', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	public async sendConfirmation(email: string) {
		return this.request<Saferwall.Session>('auth/resend-confirmation', {
			method: 'POST',
			body: JSON.stringify({
				email
			})
		});
	}

	public async resetPassword(email: string) {
		return this.request<Saferwall.Session>('auth/reset-password', {
			method: 'POST',
			body: JSON.stringify({
				email
			})
		});
	}

	public async changePassword(data: ChangePasswordDto) {
		return this.request<Saferwall.Session>('auth/password', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	public async updateProfile(data: UpdateProfileDto) {
		return this.request<Saferwall.Session>(`users/${data.username}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	public async updateEmail(data: UpdateEmailDto) {
		return this.request<Saferwall.Session>(`users/${data.username}/email`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	public async updatePassword(data: UpdatePasswordDto) {
		return this.request<Saferwall.Session>(`users/${data.username}/password`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	public async deleteAccount(username: string) {
		return this.request<any>(`users/${username}`, {
			method: 'DELETE'
		});
	}

	public async logOut() {
		return this.request('auth/logout', {
			method: 'DELETE'
		}).then(() => {
			this.authorization = undefined;
		});
	}

	private setAuthHeaders(init: RequestInit): RequestInit {
		if (this.isLoggedIn) {
			init.headers = {
				...init.headers,
				Authorization: this.authorization!
			};
		}

		return init;
	}

	private generatePaginateQuery(pagination?: Pagination): string {
		const params = {
			per_page: String(DEFAULT_PAGINATION_ITEMS),
			...(pagination ?? {})
		} as Pagination<string>;

		const query = new URLSearchParams({ ...params });

		if (query.size === 0) {
			return '';
		}

		if (this.isLoggedIn) {
			query.append('logged', '');
		}

		return '?' + query.toString();
	}
}
