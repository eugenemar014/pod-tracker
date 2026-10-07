# PODS TRACKER

A cream-and-pink inventory, sales and due-date tracker.

## Included
- Dashboard
- Products / flavors / stock / prices
- In-stock products displayed in an editable, filterable dashboard grid
- Spreadsheet pop-out window for browsing and editing product and sales records
- Multi-product sales transactions with automatic stock deduction and insufficient-stock validation
- Purchase receiving with automatic stock increases
- Due-date tracking
- Fully editable columns
- Row checkboxes
- Search
- Low-stock alerts
- Login
- Excel-compatible CSV export
- Printable PDF-style reports through the browser print dialog
- SQLite database for local development
- Hosted PostgreSQL database for persistent production data

## Run in Visual Studio Code
1. Install Node.js 20+.
2. Open this folder.
3. Run:
   npm install
   npm run install-all
   npm run dev
4. Open http://localhost:5173
5. Login:
   username: eugenemar014
   password: Namithan014

## Deploy on Render

The Render Blueprint provisions a managed free PostgreSQL database and connects it to the web service. Production uses PostgreSQL rather than the web service's local SQLite file, so saved data remains available when the web service sleeps, restarts, or redeploys. Important: Render Free Postgres expires 30 days after creation. After a further 14-day grace period, Render deletes the database and its data unless you upgrade it. This free setup does not provide permanent retention; upgrade the database to a paid plan before it expires if you need to keep the records long term.

Before switching an existing Render service to the newly provisioned database, export or back up its current records. Applying this Blueprint does not automatically transfer data from another service or database. For an available SQLite database, deploy with `MIGRATE_SQLITE_TO_POSTGRES=true` and, if needed, `SQLITE_MIGRATION_PATH` set to the database file. The migration copies users, products, clients, sales, purchases, and settings while preserving their IDs. The SQLite source must be available to the running service; data already erased by an ephemeral restart cannot be recovered. Keep the old service/database until you have verified the records in PostgreSQL, then remove it manually if desired.

Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `JWT_SECRET` in Render before using the app. The username and password initialize an empty database once; changing the app password is retained in PostgreSQL and is not overwritten on service restarts. Export regular backups and upgrade before the free database expires; persistence across sleep does not prevent expiration or replace backups.

Sales can contain multiple product lines in one transaction. All lines use the same sale date, due date, paid status, and notes, and the server saves the lines and deducts stock as one all-or-nothing operation.

For a production build:
```sh
npm run build
npm start
```
