# Brightloop

Subscription management for a recurring-revenue business: products, plans, quotations, subscriptions, recurring invoices, payments and finance reporting, plus revenue-leakage detection, dunning, renewals, customer health and a what-if simulator.

Everything runs locally on your machine. You do not need Docker, a database server, or a Cloudflare account.

## Requirements

- **Node.js 22 or newer** (24 recommended). Check with `node -v`.
- **npm 10 or newer** (comes with Node). Check with `npm -v`. If `npm run dev` fails with a `workerd` error, update npm with `npm i -g npm` and run `npm run setup` again.
- **Git**.
- Windows, macOS or Linux.

## Getting started

1. Clone the repository and open the folder:

   ```bash
   git clone https://github.com/WeaselRn/subscription-management-system.git
   cd subscription-management-system
   ```

2. Install everything and create the local database with test accounts:

   ```bash
   npm run setup
   ```

   This installs dependencies, creates a local database in `.wrangler/`, applies the migrations, and adds the test accounts and a small catalog.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open **http://localhost:5173**. If that port is taken, the terminal shows the port it used instead (for example 5174).

### Test accounts

| Role | Email | Password | What they see |
| --- | --- | --- | --- |
| Admin | `admin@brightloop.test` | `Brightloop!admin1` | Everything, including staff management and settings |
| Staff | `staff@brightloop.test` | `Brightloop!staff1` | Day-to-day work; catalog, taxes and discounts are view-only |
| Customer | `customer@brightloop.test` | `Brightloop!cust1` | Customer portal with their own subscriptions, invoices and payments |

You can also create a new customer account from the **Create an account** link on the sign-in page.

### Load the demo data

A fresh database has accounts and a catalog but no subscriptions or invoices. To see the app with realistic data:

1. Sign in as **admin**.
2. Open **Billing runs** in the sidebar.
3. Click **Load six-month demo scenario**.

This replays six months of billing through the real code: overdue invoices, a customer who pays late, an unmatched payment, a missed invoice, an expired discount that was still applied, subscriptions about to expire, and a cancellation request. Demo customers are labelled "(demo)". The customer account above belongs to Acme Labs and gets a subscription and invoices too.

The demo can only be loaded into an empty database. To load it again, reset first (see below).

### Start over

```bash
npm run db:reset:local
```

Deletes the local database and recreates it with the test accounts. Stop `npm run dev` first.

## Good to know

- **Emails are simulated.** Password-reset links, invoices and payment reminders are not sent. They appear under **Notifications → Email outbox** (staff and admin) and in the terminal running `npm run dev`. Use the terminal to find a password-reset link.
- **Billing runs daily at 01:00 UTC** when deployed. Locally, use **Billing runs → Run billing** to bill anything due. Running it twice never creates duplicate invoices.
- **Print / PDF**: open an invoice and click **Print / PDF**, then choose "Save as PDF" in the print dialog.
- **AI finance copilot (optional)**: works without any key, answering from built-in rules. For AI-written answers, copy `.dev.vars.example` to `.dev.vars` and set:

  ```
  AI_PROVIDER=groq        # or gemini
  AI_API_KEY=your-key
  ```

  Restart `npm run dev` after changing `.dev.vars`. Never commit `.dev.vars`.

- **Load-test data (optional)**: `npm run db:seed:bulk` adds 10,000 subscriptions and about 28,000 invoices to the local database, for checking that pages stay fast.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm run dev` fails with a `workerd` or `esbuild` error | Update npm (`npm i -g npm`), delete `node_modules`, run `npm run setup` again |
| Signing in says "Email or password is incorrect" for the test accounts | The database was not seeded. Run `npm run db:seed:local` |
| "Demo data needs an empty database" | Run `npm run db:reset:local`, then load the demo again |
| `EPERM` / `EBUSY` errors on Windows during install | Stop `npm run dev` (and any editor terminal running it), then retry |
| Page shows old data after resetting | Sign out and sign in again |
| "Too many attempts" on sign-in | Wait 5 minutes; sign-in is rate-limited |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Install dependencies, create the local database, apply migrations, add test accounts |
| `npm run dev` | Start the app and API with the local database |
| `npm test` | Run unit and integration tests |
| `npm run typecheck` | Check TypeScript across the app, API and scripts |
| `npm run build` | Production build |
| `npm run db:migrate:local` | Apply new database migrations |
| `npm run db:seed:local` | Add the test accounts and catalog |
| `npm run db:seed:bulk` | Add load-test data (10,000 subscriptions) |
| `npm run db:reset:local` | Delete and recreate the local database |
| `npm run db:generate -- --name <name>` | Create a migration after changing `db/schema.ts` |

After pulling new changes, run `npm install` and `npm run db:migrate:local` before `npm run dev`.

## Features

- Accounts and roles (admin, staff, customer), password reset and change, admin-only staff management, roles overview.
- Products with variants, plans with lifecycle options, taxes, discount rules, quotation templates and quotations.
- Subscriptions with a Draft → Quotation → Confirmed → Active → Closed lifecycle (plus pause), status history, renewals.
- Daily billing run plus "Run billing now": one invoice per period, never twice, missed periods caught up; taxes and the best eligible discount applied per line.
- Invoices (edit draft, confirm, cancel, send, print/PDF), partial and multiple payments, unmatched receipts, outstanding and overdue views.
- Dashboard, revenue, MRR, subscription, payment and overdue reports with CSV export.
- Notifications centre with unread badge and simulated email outbox.
- Revenue leakage detector, invoice anomaly detection, smart dunning, customer health score, renewal management, cancellation and retention flow, Customer 360° timeline, what-if simulator, optional AI finance copilot.
- Customer portal: own subscriptions (accept or decline quotations, pause, resume, renew, cancel), invoices and payments.

## Project layout

```
db/            Database schema
migrations/    SQL migrations
shared/        Code used by both browser and server (pricing, validation, permissions)
worker/        API (Hono on Cloudflare Workers) and daily jobs
src/           React app
tests/         Unit and integration tests
scripts/       Seed and reset scripts
docs/          Architecture, schema, API, design system, team ownership
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [API and service contracts](docs/api-contracts.md)
- [Design system](docs/design-system.md)
- [Team ownership](docs/team-ownership.md)
- [Contribution guide](docs/contribution-guide.md)
