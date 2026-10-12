# Deployment Guide: NICE Guidance Assistant on Linux / DGX Spark

This guide explains how to deploy the **Clinical Guidance Assistant** onto your Linux DGX Spark machine using Docker Compose.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                          Host (DGX Spark)                               |
|                                                                         |
|  Port 8080                                                              |
|     |                                                                   |
|     v                                                                   |
|  [nice_bat_frontend]                                                    |
|  (Nginx Alpine: Serves React static build + proxies /api to backend)    |
|     |                                                                   |
|     +----------> [nice_bat_backend] (FastAPI, Port 8000)                |
|                        |                                                |
|                        v                                                |
|                   [./data/nice_bat.db] (Persistent SQLite volume)       |
+-------------------------------------------------------------------------+
```

---

## Step 1: Ship the Repository via GitHub

On your current Windows development machine:

1. Create a **Private Repository** on GitHub (e.g. `nice-guidance-assistant`).
2. Open PowerShell in `C:\Users\ASAMU\agy-base` and run:

```powershell
cd C:\Users\ASAMU\agy-base
git init
git add .
git commit -m "Initial commit: Production-ready NICE Guidance Assistant"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

*(Note: The included `.gitignore` strictly prevents any `.db` databases, `.venv`, or sensitive credentials from ever being uploaded).*

---

## Step 2: Clone onto the Spark Machine

On your Linux DGX Spark terminal:

```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>
```

---

## Step 3: Launch with Docker Compose

Ensure Docker and Docker Compose are installed on the Spark, then run:

```bash
docker compose up -d --build
```

This will:
* Build the Python FastAPI backend container.
* Compile the React frontend and bundle it into an optimized Nginx container.
* Mount `./data` for persistent database storage (data is never lost on restart or rebuild).
* Start both services as background daemons that restart automatically on system reboot.

To verify containers are running:
```bash
docker compose ps
```

---

## Step 4: Set Up Your Master Admin Profile

Run the setup script inside the running backend container:

```bash
docker compose exec backend python create_admin.py
```

It will interactively prompt for:
1. **NHS Email**: Your email (e.g. `a.samuels@lhch.nhs.uk`)
2. **Display Name**: Your full name (e.g. `Archibald Samuels`)
3. **Password / PIN**: A secure master password of your choice

*Or run it with flags in a single command:*
```bash
docker compose exec backend python create_admin.py \
  --email "a.samuels@lhch.nhs.uk" \
  --name "Archibald Samuels" \
  --trust "Liverpool Heart and Chest Hospital" \
  --password "YourMasterPassword123!"
```

---

## Step 5: Access from Any Hospital Computer

1. Find the internal IP address of the Spark machine:
   ```bash
   hostname -I
   ```
   *(e.g. `10.45.2.123`)*

2. Open Google Chrome or Microsoft Edge on any Trust workstation and navigate to:
   ```
   http://<spark-ip>:8080
   ```
   *(e.g. `http://10.45.2.123:8080`)*

3. Sign in with your Master Admin email and password.

---

## Useful Operational Commands

* **View live logs:**
  ```bash
  docker compose logs -f
  ```
* **Restart the services:**
  ```bash
  docker compose restart
  ```
* **Update the application after pushing code changes to GitHub:**
  ```bash
  git pull
  docker compose up -d --build
  ```
* **Backup the database:**
  ```bash
  cp ./data/nice_bat.db ./backup_$(date +%F).db
  ```
