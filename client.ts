import axios from "axios";
import * as fs from 'fs';
import { exit } from "process";
import * as readline from 'readline';

require("dotenv").config();

const EVENTS_FILE = process.env.EVENTS_FILE || 'events.jsonl';
const EVENT_SERVER_PORT = process.env.EVENT_SERVER_PORT || 8000;
const EVENT_SERVER_URL = process.env.EVENT_SERVER_URL || `http://localhost:${EVENT_SERVER_PORT}`;
const SECRET_VALUE = process.env.SECRET_VALUE || "secret";
const MAX_CONCURRENT_REQUESTS = 64;
const processLinesPromises: any = [];

class EventHandler {

    static async readJsonlFile() {

        try {
            const fileStream = fs.createReadStream(EVENTS_FILE).setEncoding('utf8');
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity,
            });

            for await (const line of rl) {
                const event = JSON.parse(line);
                if (EventHandler.validateEvent(event)) {
                    const processLinePromise = EventHandler.processLine(line);
                    if (processLinePromise) {
                        processLinesPromises.push(processLinePromise);
                    }
                    if (processLinesPromises.length >= MAX_CONCURRENT_REQUESTS) {
                        const responses = await Promise.all(processLinesPromises);
                        responses.forEach(response => {
                            if (response.status !== 200) {
                                console.error('Error in liveEvent request:', response.data);
                            }
                        });
                        processLinesPromises.length = 0;
                    }
                } else {
                    console.log(`Skipping invalid event: ${line}`);
                }
            }

            // process the remaining lines
            if (processLinesPromises.length > 0) {
                const responses = await Promise.all(processLinesPromises);
                responses.forEach(response => {
                    if (response.status !== 200) {
                        console.error('Error in liveEvent request:', response.data);
                    }
                });
            }

        } catch (error) {
            console.error(`Error processing events: ${error}`);
        }
    }

    static processLine(line: string) {
        try {
            const event = JSON.parse(line);
            if (EventHandler.validateEvent(event)) {
                //console.log(event);
                return axios.post(`${EVENT_SERVER_URL}/liveEvent`,
                    event,
                    {
                        headers: {
                            'Authorization': SECRET_VALUE
                        }
                    }
                );
            } else {
                console.log(`Skipping invalid event: ${line}`);
            }
        } catch (error) {
            console.error(`Error processing line: ${line}. Error: ${error}`);
        }
        return null;
    }

    static validateEvent(event: any): boolean {
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
}

async function main() {
    console.log("Starting to generate events...");
    try {
        await EventHandler.readJsonlFile();
    } catch (error) {
        console.error("Error generating events", error);
    }
    console.log("Finished to generate events...");
}

main();