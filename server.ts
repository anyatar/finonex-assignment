import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import { Pool } from 'pg';
import { param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const EVENT_SERVER_PORT = process.env.EVENT_SERVER_PORT || 8000;
const SECRET_VALUE = process.env.SECRET_VALUE || "secret";
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.DB_NAME || 'finonex';
const DB_PASSWORD = process.env.DB_PASSWORD || '1234';
const DB_PORT = process.env.DB_PORT || '5432';
const SERVER_EVENTS_FILE = process.env.SERVER_EVENTS_FILE || 'server_events.jsonl';


const app = express();
app.use(bodyParser.json());

const pool = new Pool({
    user: DB_USERNAME,
    host: DB_HOST,
    database: DB_NAME,
    password: DB_PASSWORD,
    port: Number(DB_PORT)
});

// middleware for authorization
app.use((req: Request, res: Response, next: NextFunction) => {
    const clientToken = req.headers.authorization;
    if (clientToken === SECRET_VALUE) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
});

app.post('/liveEvent', (req: Request, res: Response) => {
    try {
        const event = req.body;
        console.log(event);
        if (validateEvent(event)) { 
            const eventLine = JSON.stringify(event) + '\n';
            fs.appendFileSync(SERVER_EVENTS_FILE, eventLine);
            res.status(200).send('Event received and appended.');
        } else {
            res.status(400).send('Invalid event.');
        }
    } catch (error) {
        console.error('Error handling event:', error);
        res.status(500).send('Error handling event.');
    }
});

app.get('/userEvents/:userid', [
    param('userid')
      .exists()
      .isString()
      .withMessage('User id should exist and also must be a string'),
  ], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.params.userid;
        const { rows } = await pool.query('SELECT * FROM users_revenue WHERE user_id = $1', [userId]);
        if (!rows.length) {
            return res.status(404).send('User not found.');
        }
        res.status(200).json(rows[0]);

    } catch (error) {   
        console.error('Error fetching user events:', error);
        res.status(500).send('Error fetching user events.');
    }
});

app.listen(EVENT_SERVER_PORT, () => {
    console.log(`Server listening on port ${EVENT_SERVER_PORT}`);
});


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