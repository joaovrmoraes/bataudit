import type { UUID } from "node:crypto";

interface Audit {
    id: UUID,
    identifier: string,
    user_email: string,
    user_name: string,
    method: string,
    path: string,
    status_code: number,
    service_name: string,
    timestamp: string
}

interface ListAuditResponse {
    data: Audit[],
    total: number
}

interface ListAuditParams {
    page?: number;
    limit?: number;
}

export async function ListAudit(params?: ListAuditParams): Promise<ListAuditResponse> {
    const query = params
        ? `?page=${params.page}&limit=${params.limit}`
        : '';

    const res = await fetch(`http://localhost:8080/audit${query}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
        
    });

    return await res.json();
}
