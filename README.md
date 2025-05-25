# AvaScope: Avalanche Subnet Monitoring Dashboard

AvaScope is a comprehensive, AI-powered monitoring dashboard for Avalanche subnets or L1's. Specifically for this hackathon, I referred to them as subnets, as I tested this on the Subnet beam. However, it is extendable to avalanche L1's as well. It provides real-time and historical insights into various subnet metrics, helping developers and operators track performance, health, and activity of their Avalanche-based blockchains. The data is feched and pushed into a database, so that the AI-Agent Ava is able to actually access and utilize this data in her analysis.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Environment Configuration](#2-environment-configuration)
    - [Frontend (`.env`)](#frontend-env)
    - [Backend (`backend/.env`)](#backend-env)
  - [3. Install Dependencies](#3-install-dependencies)
  - [4. Set Up Supabase](#4-set-up-supabase)
  - [5. Run Migrations](#5-run-migrations)
- [Running the Application](#running-the-application)
  - [Frontend](#frontend)
  - [Backend API Server](#backend-api-server)
- [Running Backfill Scripts](#running-backfill-scripts)
- [Backend API Endpoints](#backend-api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Features

-   **Subnet Management:** Add, edit, and remove subnets to monitor.
-   **Real-time Metrics:** View live data for TPS, block production, gas utilization, and more.
-   **Historical Data:** Track trends and analyze past performance with historical charts.
-   **ERC Transfer Tracking:** Monitor ERC20/ERC721 transfer volumes.
-   **Validator & Delegator Counts:** Display staking statistics for the chosen network.
-   User-friendly interface with a focus on data visualization.

## Architecture Overview

AvaScope consists of four main parts:

1.  **Frontend:** A React application (built with Vite and TypeScript) that provides the user interface for displaying subnet metrics and managing subnets.
2.  **Backend API Server:** An Express.js server (TypeScript) that serves as an intermediary for certain actions and can be expanded for more complex data processing or aggregated queries. It also includes worker processes.
3.  **Supabase:** Used as the primary database for storing subnet configurations, user data (via Supabase Auth), and polled historical metrics. Supabase's real-time capabilities can also be leveraged.
4.  **Data Polling Workers/Scripts:** TypeScript scripts (`backend/src/worker/poller.ts`, `backend/scripts/backfillTransfers.ts`, etc.) responsible for fetching data from subnet RPC endpoints at regular intervals and storing it in Supabase. These also handle initial backfilling of historical data.

## Tech Stack

-   **Frontend:** React, Vite, TypeScript, Tailwind CSS, Tremor (for UI components), Recharts (for charts)
-   **Backend:** Node.js, Express.js, TypeScript
-   **Database:** Supabase (PostgreSQL)
-   **RPC Interaction:** Axios/RPC URL's
    **Onchain interaction:** eth_getLogs
-   **Staking Metrics:** `@avalabs/avacloud-sdk`

## Prerequisites

-   Node.js (v18 or later recommended)
-   npm or yarn
-   Git
-   Access to a Supabase project (currently self-hosted, will be cloud-hosted for production).
-   An AvaCloud API Key (for certain metrics like validator/delegator counts).
-   An OpenAI API Key (Note: The specific use of this key in AvaScope needs to be defined. It's included here as per request, but its integration into the application logic is not yet detailed in this README).

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AvaScope
```

### 2. Environment Configuration

You'll need to set up environment variables for both the frontend and backend.

#### Frontend (`.env`)

Create a `.env` file in the root of the project:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Example:
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...
```

The Supabase backend API's are not hosted on Render unfortunately, so testing of the backlog and real-time metrics with onboarding your own account will not be possible. However, you can run the frontend locally to get a feel for it and create your own account even/look through the UI.

#### Backend (`backend/.env`)

Create a `.env` file in the `backend/` directory:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
AVACLOUD_API_KEY=your_avacloud_api_key
OPENAI_API_KEY=your_openai_api_key

# Example:
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...
# AVACLOUD_API_KEY=avaxc_test_xxxxxxxxxxxxxxxxx
# OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxx
```

Replace the placeholder values with your actual Supabase URL, anon key, service role key, AvaCloud API key, and OpenAI API key.

**Important Security Note:** The `SUPABASE_SERVICE_ROLE_KEY` provides administrative access to your Supabase project. Keep it secret and never expose it in client-side code.

### 3. Install Dependencies

Install dependencies for both the root (frontend) and the backend:

```bash
# Install root/frontend dependencies
npm install
# Or if using yarn:
# yarn install

# Install backend dependencies
cd backend
npm install
# Or if using yarn:
# yarn install
cd ..
``

## Running the Application

### Frontend

From the root directory:

```bash
npm run dev
# Or if using yarn:
# yarn dev
```

This will start the Vite development server, typically on `http://localhost:5173`.

### Backend API Server

From the `backend/` directory:

```bash
npm run dev
# Or if using yarn:
# yarn dev
```

This will start the Express API server, typically on `http://localhost:3001`.

## Running Backfill Scripts

AvaScope includes scripts to backfill historical data for subnets. These are useful for initializing data for a newly added subnet or for catching up on missed data.

**General Backfill (Metrics & ERC Transfers):**

Located at `backend/scripts/backfillTransfers.ts`. This script has an example subnet hardcoded in its `main` function. You can modify this for one-off backfills or adapt it to take parameters.

```bash
cd backend
npx ts-node scripts/backfillTransfers.ts
```

**ERC Transfers Only Backfill:**

Located at `backend/scripts/backfillONLYtransfers.ts`. Similar to the above, it has an example subnet.

```bash
cd backend
npx ts-node scripts/backfillONLYtransfers.ts
```

**Polling Worker:**

The primary data collection mechanism is the polling worker, which continuously fetches live data and recent historical data.

```bash
cd backend
npm run start:poller
# Or directly:
# npx ts-node src/worker/poller.ts
```

## Backend API Endpoints

The backend exposes a few API endpoints under the `/api` prefix. (Note: Authentication for these endpoints is currently using a placeholder `mock-user-id` and needs to be fully implemented with Supabase Auth for production).

-   **`GET /api/subnets`**: Lists all subnets for the (mock) authenticated user.
-   **`POST /api/subnets`**: Adds a new subnet. Expects `name` and `rpc_url` in the request body.
-   **`DELETE /api/subnets/:id`**: Deletes a user's subnet by its ID.
-   **`GET /api/metrics/live/:subnetId`**: Fetches live metrics for a given `subnetId` by proxying to the subnet's RPC and using the AvaCloud SDK.
-   **`GET /api/metrics/historical/:subnetId`**: Retrieves historical aggregated metrics for a `subnetId` from the Supabase database. (Implementation may vary based on specific needs for charts).

## Thank you!!

Thanks for reading, and please feel free to make contributions / pull requests 
