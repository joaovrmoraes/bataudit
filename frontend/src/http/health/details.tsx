
export interface HealthResponse {
    api_response_ms: number;
    db_response_ms: number;
    db_status: string;
    environment: string;
    message: string;
    status: string;
    version: string;
}

export async function getHealthDetails(): Promise<HealthResponse> {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/health`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) throw new Error('Failed to fetch health status')

    return await response.json();
}