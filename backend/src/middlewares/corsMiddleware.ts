import cors from 'cors';
import { config } from '../utils/config';

const isLocalOrigin = (origin: string) => {
    try {
        const url = new URL(origin);
        return (
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '::1' ||
            url.hostname === '0.0.0.0' ||
            url.hostname.endsWith('.localhost')
        );
    } catch {
        return false;
    }
};

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        if (!origin || isLocalOrigin(origin) || config.cors.origins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
});