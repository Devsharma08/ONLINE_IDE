import dotenv from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), process.env.NODE_MODE === 'production' ? '.env.production' : '.env.development');
const result = dotenv.config({
    path: envPath,
    override: true
});

if (result.error) {
    const fallbackPath = resolve(process.cwd(), '.env');
    dotenv.config({
        path: fallbackPath,
        override: false
    });
    console.warn(`Could not load ${envPath}. Falling back to ${fallbackPath}.`);
}

const requiredEnv = ['DIRECT_URL', 'DATABASE_URL', 'GITHUB_KEY'];
for (const key of requiredEnv) {
    const value = process.env[key];
    if (!value) {
        console.warn(`Missing required environment variable: ${key}`);
    }
    if (value && typeof value === 'string' && value.startsWith('your_')) {
        console.warn(`Environment variable ${key} appears to be a placeholder value. Replace it with a real secret.`);
    }
}
