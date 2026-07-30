export type ValidUrlDetails = {
    url?: string;
    isValid: boolean,
    hostname?: string
}

export const getValidUrlDetails = (urlValue: unknown): ValidUrlDetails => {
    if (typeof urlValue !== 'string') return { isValid: false };

    const normalisedUrlText: string = urlValue.trim();
    try {
        const parsedUrl = new URL(normalisedUrlText);
        const isValidProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    
        return {
            url: isValidProtocol ? parsedUrl.toString() : undefined,
            isValid: isValidProtocol,
            hostname: parsedUrl.hostname
        }
    } catch {
        return {
            isValid: false
        };
    }
};