# Deployment & Operations Guide

This document covers the practical steps for running the FARTNODE distributor in production-like environments.

## 1. Prerequisites

1. Node.js 20+ and npm installed on the target host.
2. Project cloned to the desired directory (e.g. `/opt/fartnode-distributor`).
3. `.env` populated with production values (never commit this file).
4. Creator + Rewards Vault keypairs encoded as base58 strings in `.env`.
5. RPC endpoint sized for the expected holder count (private or dedicated RPC recommended for mainnet).

## 2. Installation

```bash
cd /opt/fartnode-distributor
git pull
npm install
npm run build
```

## 3. Running a Single Epoch

```bash
npm run epoch
```

`npm run epoch` executes the compiled JavaScript (`dist/index.js`) and performs a full claim + distribution cycle exactly once.

For development or troubleshooting use:

```bash
npm run dev:epoch
```

which runs the TypeScript sources directly via `ts-node` (handy with devnet RPC + keys).

## 4. Cron / Systemd Automation

The distributor is designed to run periodically (e.g. once per day). Example cron entry that triggers the epoch at 00:05 UTC and records logs under `logs/`:

```cron
5 0 * * * cd /opt/fartnode-distributor && /usr/bin/npm run epoch >> logs/fartnode.log 2>&1
```

### Systemd Oneshot Service

`/etc/systemd/system/fartnode.service`:

```ini
[Unit]
Description=FARTNODE Distributor Epoch

[Service]
Type=oneshot
WorkingDirectory=/opt/fartnode-distributor
EnvironmentFile=/opt/fartnode-distributor/.env
ExecStart=/usr/bin/npm run epoch
StandardOutput=append:/opt/fartnode-distributor/logs/fartnode.log
StandardError=append:/opt/fartnode-distributor/logs/fartnode.log
```

`/etc/systemd/system/fartnode.timer`:

```ini
[Unit]
Description=Daily FARTNODE Epoch

[Timer]
OnCalendar=*-*-* 00:05:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fartnode.timer
```

## 5. Logs & Metrics

- Structured JSON logs stream to stdout and should be redirected to `logs/fartnode.log` (or central logging).
- Epoch summaries append to `data/epochs.jsonl`. Do not delete this file unless you intentionally want to clear monitoring history.
- Run `npm run monitor` to start the local Express UI on port `8787` (configurable via `MONITOR_PORT`). This UI is meant for localhost/VPN use only.

## 6. Key & Parameter Management

### Rotating Keys

1. Generate new keypairs and fund them (Creator + Rewards Vault).
2. Update `.env` with the new base58 secrets.
3. Restart any running cron/systemd services (or wait for the next run). No code changes required.

### Changing Thresholds / Eligibility Rules

Update the relevant values inside `.env`:

- `USD_THRESHOLD`
- `DISTRIBUTION_PERCENT`
- `MIN_ELIGIBLE_BALANCE`
- `MAX_ELIGIBLE_BALANCE`

Then redeploy (if necessary) and restart cron/systemd to load the new configuration.

### Pausing Distribution

Disable cron/systemd execution:

```bash
crontab -e   # remove or comment the line
# OR
sudo systemctl stop fartnode.timer
```

Funds remain in the Rewards Vault during a pause. Re-enable the automation when ready.

## 7. Safety Checklist Before Mainnet

- Confirm `.env` references the correct mainnet mint, RPC, and keypairs.
- Ensure Rewards Vault holds enough SOL for transaction fees plus planned distributions.
- Perform a dry run with `npm run epoch` while monitoring stdout logs.
- Keep an eye on `data/epochs.jsonl` and the monitoring UI for sanity checks after each run.
