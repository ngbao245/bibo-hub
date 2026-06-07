// Fetch wrapper đơn giản - throw nếu response status không OK.
// Dùng trong các query/mutation hooks.

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} - ${res.statusText} on ${url}`);
    }
    return res.json() as Promise<T>;
}