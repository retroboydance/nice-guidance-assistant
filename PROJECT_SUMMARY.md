# NICE Guidance Baseline Assessment Tool

## 🎯 Project Origin & Goal
This project was born out of a critical problem in clinical governance: clinicians often fail to complete NICE baseline assessments because the standard format—a massive, overwhelming Excel spreadsheet with 80+ rows—is unintuitive and difficult to navigate. 

**The Goal:** Create a digital "wizard-style" tool that presents one recommendation at a time, tracks progress, auto-saves, and automatically calculates compliance and action plans. 

**The Challenge:** It had to be deployed in a strict NHS IT environment where installing new software (like Python or custom `.exe` files) or requiring advanced cloud infrastructure (like custom Power Apps) was either blocked by security or proved too rigid/difficult to maintain.

---

## 🏗️ Current Architecture (The "Zero-Install" App)
To bypass NHS IT restrictions while providing a modern web-app experience, this tool currently uses a highly creative, **100% portable architecture** that runs entirely off a shared network drive using native Windows tools.

*   **The Backend (PowerShell):** Uses `server.ps1`, a PowerShell script that spins up a lightweight local `HttpListener` web server on `localhost:8080`. (Because PowerShell is natively installed on every Windows machine, it requires zero IT approval).
*   **The Database (SQLite):** Uses `sqlite3.exe`, the official 1MB standalone command-line tool, to manage a local `assessments.db` file. 
*   **The Frontend (HTML/JS):** A single `ui.html` file that serves as a Single Page Application (SPA). It uses TailwindCSS for modern styling and `fetch()` APIs to talk to the PowerShell backend.
*   **The Launcher:** `Run_Assessment.bat` safely bypasses local execution policies, starts the server, and pops open the clinician's web browser.

---

## ✨ Core Features & Workflows
1.  **Dynamic Guidance Uploads:** On the landing page, a user can upload a standard NICE Excel spreadsheet. The frontend uses `SheetJS` to parse the Excel file in the browser, extracts the recommendations, and sends a JSON payload to the backend to create a new guidance in the database.
2.  **Wizard Interface:** The app displays a side-by-side layout: the read-only NICE recommendation is fixed on the left, and the assessment form (Relevant, Met, Action needed, Deadline, etc.) is on the right.
3.  **Stateful Auto-Saving:** As a clinician navigates ("Next"/"Previous"), the app silently `POST`s the data to the backend. A user can close the app and return months later, and all responses will be perfectly preserved.
4.  **Live Compliance Reporting:** The app features a "View Report" dashboard that calculates:
    *   **Compliance %:** `(Total Met / Total Relevant) * 100`
    *   **Action Plan:** An automatically generated table of all recommendations where `Relevant = Yes` but `Met = No/Partial`.

---

## 🗄️ Database Schema
The SQLite database (`assessments.db`) is highly relational, avoiding data duplication:

*   **`guidelines`**: `id`, `name` *(e.g., "Pneumonia in Adults")*
*   **`recommendations`**: `id`, `guideline_id`, `rec_text`, `guideline_rec`, `rec_year`
*   **`assessments`**: `id`, `rec_id`, `relevant`, `evidence`, `meet`, `action`, `risk`, `cost`, `capacity`, `deadline`, `lead`, `completed_by` *(Note: `rec_id` must be UNIQUE so there is only one assessment per recommendation).*

**Database Views:**
The database also contains two permanent `VIEWS` (`compliance_summary` and `action_plan`) to allow easy extraction of data into tools like PowerBI or Excel.

---

## 🚀 Future Evolution (Scaling for other Trusts)
While the current PowerShell/SQLite architecture is a brilliant "hack" to bypass local NHS IT restrictions for a single trust/department, scaling this to multiple trusts will likely require a modern architectural overhaul.

**Considerations for the new Antigravity project:**
1.  **Cloud Hosting:** Transitioning the PowerShell backend to a robust web framework (e.g., Python FastAPI, Django, or Node.js) hosted on a cloud server.
2.  **Database Migration:** Moving from SQLite to a robust cloud database (like PostgreSQL) to handle concurrent multi-trust users securely.
3.  **Authentication & Multi-Tenancy:** The current app has no login system. The next evolution will need secure login (NHS SSO/Azure AD) and multi-tenancy so Trust A cannot see Trust B's baseline assessments.
4.  **Preserving the UX:** The core triumph of this tool is its UX (the wizard-style form and the automatic Excel-parsing uploader). The new architecture must preserve this frictionless frontend experience.

**Rollout plan: prove it in our group first**
*   **Proof of concept:** Deploy across our NHS group, which is 3 Trusts recently merged under a group model. A group-wide DPIA already allows sharing of non-patient data between them.
*   **Access model:** Each Trust is a separate tenant. Most users see only their own Trust. A group-level role (e.g. group audit or governance leads) can see all 3 Trusts, which allows group-wide compliance reporting and shared learning.
*   **Login:** The Trusts are part-way through moving to shared IT, so the tool must accept NHS logins from more than one Microsoft Entra ID tenant.
*   **Hosting:** To be confirmed with group IT (likely the group's Azure environment).
*   **Then scale:** Once the proof of concept works, offer the tool to Trusts outside the group. They will be fully isolated tenants, and full external assurance (DTAC, penetration test) will be needed.

---

## 🔭 Vision: From Baseline Assessment to Clinical Audit & Quality Improvement
The baseline assessment is only the starting point. It records what a Trust *says* it does. The long-term aim is to **improve clinical audit capability across the NHS**, so that clinical professionals can *measure* what actually happens in practice, act on the results, and drive real quality improvement and patient safety.

**The improvement cycle the tool will support:**
1.  **Assess:** Complete the NICE baseline assessment (the current wizard).
2.  **Design:** For recommendations that are not fully met (or need assurance), design a clinical audit tailored to that recommendation: criteria, target %, exceptions, data source, sample and a data collection proforma.
3.  **Measure:** The Trust collects audit data **in its own systems**, using the tools generated for it. Patient data never enters this tool.
4.  **Analyse:** Enter the aggregate results (numerator, denominator, exclusions). The tool applies tested statistical methods, for example confidence intervals, comparison between audit cycles, and run charts or SPC charts.
5.  **Act & re-audit:** Link the results to the action plan, then repeat the audit to show whether practice has improved.

**Planned capabilities (AI-assisted, not yet designed):**
*   **Audit design assistant:** Drafts audit criteria, targets, exceptions, data sources and sampling for each NICE recommendation, based on the recommendation text and related NICE quality standard measures.
*   **Bespoke audit & analysis tools:** Generates data collection proformas and statistical analysis templates (for example sample size calculators) that Trusts use on their own data.
*   **Assessment & reporting support:** Suggests relevance, flags gaps in evidence, drafts clear actions and writes report narratives for governance committees.
*   **Cross-Trust learning:** Finds common themes in recorded actions and offers them as anonymised guidance to other Trusts.

**Guiding principles:**
*   **No patient data, ever:** The tool holds only organisational governance data, audit designs and aggregate results.
*   **Human in the loop:** AI only suggests. Clinicians review and confirm everything, and AI-generated content is clearly labelled.
*   **Grounded in NICE:** AI output is based on NICE source material and shows its source, but is never presented as NICE guidance.
*   **Trustworthy numbers:** Compliance %, audit results and statistics come from tested code, never from an AI model.
*   **Safe sharing:** Cross-Trust insights are opt-in, de-identified, aggregated across enough Trusts that no single Trust can be identified, and reviewed by a person before they are published. Tenant isolation is never broken.
*   **Information governance first:** Any AI provider must offer UK data residency, must not train on Trust data, and must pass NHS IG review (DPIA, DTAC).
