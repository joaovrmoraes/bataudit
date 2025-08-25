
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
    const response = await fetch('http://localhost:8080/health', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    return await response.json();
}