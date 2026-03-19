# GigShield — AI-Powered Parametric Insurance for Delivery Workers

**Parametric income-loss insurance for India's gig economy delivery workers (Zomato & Swiggy partners).**

---

## Problem Statement

India's gig economy delivery workers — over 10 million active riders on platforms like Zomato and Swiggy — face constant income disruption from weather events (monsoon flooding, cyclones), air quality crises, and urban curfews or strikes. Unlike formal-sector employees, they have no employer-backed insurance, no sick leave, and no safety net. A single week of heavy rainfall in Mumbai can wipe out 80% of a delivery partner's expected earnings with zero compensation.

Traditional insurance models fail these workers: claim processes are slow and complex, premiums are unaffordable, and coverage doesn't match the weekly income cycle of gig work. **GigShield** solves this with *parametric insurance* — a model where claims are triggered automatically by measurable external events (rainfall thresholds, AQI levels, curfew announcements) with no manual filing required. Premiums are charged weekly at 3% of income, and payouts are instant, calculated as a direct percentage of the worker's lost income.

---

## Architecture

```
┌──────────┐
│  Worker   │
│  (App)    │
└────┬─────┘
     │
     ▼
┌──────────────┐      ┌──────────────┐
│  Onboarding  │─────▶│   Database   │◀──────┐
│  (Register/  │      │  (PostgreSQL)│       │
│   Login)     │      └──────┬───────┘       │
└──────────────┘             │               │
                             ▼               │
┌──────────────┐      ┌──────────────┐      │
│ External APIs│─────▶│ Event Engine │      │
│ (Weather/AQI)│      │ (Parametric  │      │
└──────────────┘      │  Triggers)   │      │
                      └──────┬───────┘      │
                             │               │
                             ▼               │
                      ┌──────────────┐      │
                      │ Payout Engine│──────┘
                      │ (Compute &   │
                      │  Disburse)   │
                      └──────┬───────┘
                             │
                             ▼
┌──────────────┐      ┌──────────────┐
│  Scheduler   │─────▶│  Payment     │
│ (APScheduler)│      │  Service     │
│              │      │  (Razorpay)  │
└──────────────┘      └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  Dashboard   │
                      │ (Worker/Admin│
                      │  Analytics)  │
                      └──────────────┘
```

---

## Setup Instructions

### Prerequisites

- **Python 3.11+**
- **Docker & Docker Compose**
- **pip** (or Poetry)

### 1. Clone & Install

```bash
cd gigshield
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (defaults work for local dev)
```

### 4. Run Migrations

```bash
alembic upgrade head
```

### 5. Start Server

```bash
uvicorn app.main:app --reload
```

API docs available at: **http://localhost:8000/docs**

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://gigshield:password@localhost:5432/gigshield` |
| `SECRET_KEY` | JWT signing secret | `your-jwt-secret-here` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry | `60` |
| `USE_MOCK_APIS` | Use mock external APIs (weather, platform) | `true` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key (live mode) | — |
| `RAZORPAY_KEY_ID` | Razorpay payment gateway key ID | — |
| `RAZORPAY_KEY_SECRET` | Razorpay payment gateway secret | — |

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | No | Health check |
| `GET` | `/health` | No | Detailed health status |
| `POST` | `/api/v1/workers/register` | No | Register a new delivery worker |
| `POST` | `/api/v1/workers/login` | No | Login with phone + OTP → JWT |
| `GET` | `/api/v1/workers/me` | Yes | Get authenticated worker's profile |
| `POST` | `/api/v1/pricing/calculate` | Yes | Calculate weekly premium for worker |
| `POST` | `/api/v1/policies` | Yes | Create a new weekly insurance policy |
| `GET` | `/api/v1/policies/me` | Yes | List all policies for worker |
| `GET` | `/api/v1/policies/{policy_id}` | Yes | Get policy detail |
| `POST` | `/api/v1/events/trigger` | No* | Ingest disruption event → auto-create claims |
| `GET` | `/api/v1/claims/me` | Yes | List all claims for worker |
| `GET` | `/api/v1/claims/{claim_id}` | Yes | Get claim detail |
| `GET` | `/api/v1/payouts/me` | Yes | List payout history |
| `POST` | `/api/v1/payouts/{claim_id}/process` | Yes | Process payout for a claim |
| `GET` | `/api/v1/dashboard/worker` | Yes | Worker dashboard summary |
| `GET` | `/api/v1/dashboard/admin` | No* | Admin dashboard summary |

*\*Admin endpoints are open in Phase 1 — role-based access control is planned for Phase 2.*

---

## Pricing Model

GigShield uses a transparent, three-factor weekly premium calculation:

```
weekly_premium = base_premium × zone_risk_multiplier × weather_risk_factor
```

| Component | Formula | Range |
|---|---|---|
| **Base Premium** | `avg_weekly_income × 0.03` (3%) | — |
| **Zone Risk Multiplier** | City-based historical flood data | 1.0 – 1.5 |
| **Weather Risk Factor** | Season + city combination | 1.0 – 1.3 |
| **Coverage Amount** | `avg_weekly_income × 0.80` (80% replacement) | — |

### Example: Mumbai Worker Earning ₹8,000/week

| Step | Calculation | Result |
|---|---|---|
| Base Premium | ₹8,000 × 0.03 | ₹240 |
| Zone Risk (Mumbai) | × 1.50 | ₹360 |
| Weather Risk (Monsoon) | × 1.30 | **₹468/week** |
| Coverage | ₹8,000 × 0.80 | **₹6,400** |

> The worker pays **₹468/week** and is covered for up to **₹6,400** of income loss per disruption event.

---

## Parametric Triggers

| Event Type | Threshold | Auto-Action |
|---|---|---|
| **Rainfall** | > 50 mm in 24 hours in worker's city | Auto-create `income_loss` claim for all active policies in affected city |
| **AQI** | > 300 in worker's zone | Auto-create `income_loss` claim for all active policies in affected city |
| **Curfew / Strike** | Boolean flag = `true` for city | Auto-create `income_loss` claim for all active policies in affected city |

**Severity-based payout ratios:**

| Severity | Payout (% of coverage) |
|---|---|
| Low | 25% |
| Medium | 50% |
| High | 75% |
| Critical | 100% |

---

## Phase Roadmap

### ✅ Phase 1 — Seed (Weeks 1-2) *← Current*
- Complete API scaffold with all endpoints
- SQLAlchemy models + Alembic migrations
- Pricing engine with 3-factor formula
- Parametric event trigger → auto-claim pipeline
- Mock external APIs (weather, platform, payment)
- Fraud detection stubs (duplicate claim, GPS mismatch)
- JWT authentication with OTP stub
- Worker & admin dashboards
- Docker Compose + PostgreSQL

### 🔲 Phase 2 — Build (Weeks 3-4)
- Real OpenWeatherMap & AQI API integration
- Razorpay Payouts live integration
- SMS OTP via Twilio/MSG91
- Role-based access control (worker / admin / underwriter)
- Advanced fraud detection (ML anomaly scoring)
- Policy renewal auto-flow
- Push notifications for event triggers
- Worker mobile app (React Native)

### 🔲 Phase 3 — Scale (Weeks 5-6)
- Multi-platform support (Uber Eats, Dunzo, Porter)
- Dynamic pricing with ML risk models
- Historical claims analytics dashboard
- Regulatory compliance (IRDAI sandbox)
- Load testing & production deployment (AWS/GCP)
- CI/CD pipeline with GitHub Actions

---

## Tech Stack

| Component | Technology |
|---|---|
| **Framework** | FastAPI (async) |
| **ORM** | SQLAlchemy 2.0 (async) |
| **Database** | PostgreSQL 15 |
| **Migrations** | Alembic |
| **Auth** | JWT (`python-jose`) + OTP stub (`passlib`) |
| **Scheduler** | APScheduler (async) |
| **HTTP Client** | httpx (async) |
| **Validation** | Pydantic v2 |
| **Testing** | pytest + httpx AsyncClient |
| **Env Config** | pydantic-settings |
| **Containerisation** | Docker Compose |

---

## Running Tests

```bash
# Install test dependency
pip install aiosqlite

# Run all tests
pytest tests/ -v
```

Tests use an in-memory SQLite database — no PostgreSQL required.

---

## License

MIT — Built for the Guidewire Hackathon 2026.
