# Finonex task (NodeJS, TypeScript, Postgres)
The ``` Finonex task ``` is a Client-Server-DB project that includes 3 services: Client, Server and Data Processor that consitute a data ETL process. The client is a simple script that reads events from a local file and makes a request to the server for each event. The server receives the event and appends it to a local (server-side) file. The data processor reads the events from the file and calculates the revenue for each user. The calculated revenue summary is updated in the local database. 

# Server API with Postgres DB 

| Methods	| Urls	          | Actions
| --------- | ----------------| ----------------------------------------- |
| POST      | /liveEvent         | Receives signle event and append it to the local file
| GET       | /userEvents/\<userid\>        | Returns the users' data from the local database


## Project Structure
```bash
-- client.ts
-- data_processor.ts
-- db.sql
-- events.jsonl
-- package.json
-- README.md
-- server.ts
```

## Database
The system uses a PostgreSQL database which stores the users' calculated revenue in a table named 'users_revenue' (schema in : ```db.sql```).
To setup, you need to first create the database "finonex", and then run the script in PgAdmin or any other PostgreSQL client to create the table.

## Local Installation
### Runnning locally 

\* *Environment variables are not required*, the services can run with predefined defaults.

To install dependencies run:
```sh
$ cd finonex-assignment
$ npm install
```
### Runnning the server
The server receives the event and appends it to the local file (server_events.jsonl), bufferring all received data for future processing. The server is running on port 8000 by default. Make sure to create the database and table before running the server.
PostgreSQL database connection by default is defined with following settings: `user:postgres, password: 1234, host:localhost, port:5432, database:finonex`.

- To run the server: ```npm run start_server```. 

### Runnning the client
The client generates live events taken from the local `events.jsonl` file: line by line, validates them and sends them to the server with `Authorization` header. 
To avoid overloading the server, the client limits the number of concurrent requests and sends them in batches of 64 (configurable).

- To run the client: ```npm run start_client```.

### Runnning the Data Processor

- To run dp: ```npm run process_data```. 

The Data Processor is the last step of ETL when all events are processed and revenue is calculated for each user. The calculated revenue summary is updated (inserted or updated) in the local PostgreSQL database.

#### Performance Overview of Data Processor
- In order to avoid processing the same data more than once, but retain the data for future reference - the Data Processor first renames the `server_events.jsonl` file to `server_events_<timestamp>.jsonl`.
- The Data Processor then reads the events line by line from the file, validates the event structure and sums up the revenue for each user storing only the total sum for the user in a in-memory Map. Once the entire file is processed, and all the revenue changes for each user are in memory - it updates the local database.
- The Data Processor use a transaction to update/insert the database to avoid data inconsistency and update the database in an atomic action. If it fails, the transaction is rolled back, the error is logged and the backup file is stored for recovery (recovery has not been implemented).
- If the transaction is successful, in a final step, the Data Processor renames the events file to `server_events_<timestamp>_processed.jsonl` to keep the data for backup for future use.

## More features if I had more time
The home assignment had a limited scope as required but if I had more time I would have implemented the following features:

- Failure recovery mechanism for the Data Processor
- Improve security by adding JWT token for client-server communication and user authentication
- Add more unit tests for the services and integration tests to verify integrity of the system
- Package the application for distribution (Docker)
- Add axios-concurrrency management for the client

## Useful docs
[Upsert data in PostgreSQL guide](https://www.prisma.io/dataguide/postgresql/inserting-and-modifying-data/insert-on-conflict)

[Crud REST API with Node.js and PostgreSQL](https://blog.logrocket.com/crud-rest-api-node-js-express-postgresql/)

[Express validator](https://express-validator.github.io/docs/guides/getting-started)

