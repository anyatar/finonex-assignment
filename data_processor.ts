import * as path from 'path';
import { Pool } from 'pg';
import readline from 'readline';
import fs from 'fs';

const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.DB_NAME || 'finonex';
const DB_PASSWORD = process.env.DB_PASSWORD || '1234';
const DB_PORT = process.env.DB_PORT || '5432';
const SERVER_EVENTS_FILE = process.env.SERVER_EVENTS_FILE || 'server_events.jsonl';
const PROCESSED_FILE_SUFFIX = process.env.PROCESSED_FILE_SUFFIX || '_processed';

const pool = new Pool({
    user: DB_USERNAME,
    host: DB_HOST,
    database: DB_NAME,
    password: DB_PASSWORD,
    port: Number(DB_PORT)
});

processEvents();

async function processEvents() {
    try {

        const unixTimestamp = Math.floor(Date.now() / 1000);
        const processingFile = path.basename(SERVER_EVENTS_FILE, '.jsonl') + `_${unixTimestamp}` + '.jsonl';
        await fs.promises.rename(SERVER_EVENTS_FILE, processingFile);

        console.log('Processing file:', processingFile);
        const userRevenueSummary: Map<string, number> = await processFile(processingFile);
        await updateUserRevenue(userRevenueSummary);

        const backupFile = path.basename(processingFile, '.jsonl') + PROCESSED_FILE_SUFFIX + '.jsonl'
        await fs.promises.rename(processingFile, backupFile);
        console.log('Done and renamed to file:', backupFile);

    } catch (error) {
        console.error(`Error processing data: ${error}`);
    }
}

async function processFile(filePath: string): Promise<Map<string, number>> {
    const userRevenueMap = new Map<string, number>();

    try {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            try {
                const jsonLine = JSON.parse(line);
                const { userId, name, value } = jsonLine;

                if (!validateEvent(jsonLine)) {
                    console.log(`Skipping invalid event: ${line}`);
                } else {
                    if (name === 'add_revenue') {
                        userRevenueMap.set(userId, (userRevenueMap.get(userId) || 0) + value);
                    } else if (name === 'subtract_revenue') {
                        userRevenueMap.set(userId, (userRevenueMap.get(userId) || 0) - value);
                    }
                }

            } catch (error) {
                console.error('Error parsing JSON line:', error);
            }
        }
    } catch (error) {
        console.error('Error reading file:', error);
    }

    return userRevenueMap;
}

async function updateUserRevenue(revenueMap: Map<string, number>): Promise<void> {

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const [userId, revenue] of revenueMap.entries()) {
            console.log(`Updating user ${userId} with revenue ${revenue}`);
            await client.query(
                `
        INSERT INTO users_revenue (user_id, revenue)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE
        SET revenue = users_revenue.revenue + (EXCLUDED.revenue);
        `,
                [userId, revenue]
            );
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error updating user revenue: ${error}`);
    } finally {
        await client.release();
    }
}

function validateEvent(event: any): boolean {
    if (
        typeof event.userId === 'string' &&
        (event.name === 'add_revenue' || event.name === 'subtract_revenue') &&
        Number.isInteger(event.value)
    ) {
        return true;
    } else {
        return false;
    }
}