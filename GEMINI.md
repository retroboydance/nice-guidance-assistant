# NICE Guidance Assistant

## Context

This project is the next version of the **NICE Guidance Baseline Assessment Tool (BAT)**. The tool helps NHS clinicians complete NICE baseline assessments. They answer one recommendation at a time in a wizard, not in an 80+ row Excel spreadsheet. The tool then works out compliance and an action plan for them.

- **Background:** See `PROJECT_SUMMARY.md` for the project's origin, the current architecture and the planned changes. Read it before you make architectural decisions.
- **Current (legacy) version:** A "zero-install" app that runs from a shared network drive. It uses `Run_Assessment.bat` (launcher), `server.ps1` (PowerShell `HttpListener` on `localhost:8080`), `sqlite3.exe` + `assessments.db`, and a single-page `ui.html` (TailwindCSS + SheetJS). The legacy code is **not** in this workspace. Do not assume it is here, and do not invent its contents.
- **This project:** Scale the tool to work across several NHS Trusts. That means cloud hosting, a robust database, authentication and multi-tenancy, while **keeping the existing UX**.
- **Overall aim:** Improve clinical audit capability so that it drives effective quality improvement and patient safety. The baseline assessment is the starting point. The longer-term goal is to help clinical professionals design and carry out good clinical audits and statistical analysis, tailored to each NICE guideline.
- **Rollout plan:** First, a proof of concept across the user's NHS group (3 Trusts that recently merged under a group model). A group-wide DPIA already allows sharing of non-patient data between these Trusts. Later, scale to Trusts outside the group. Build for the later stage from the start (tenant isolation, configurable Trusts and groups), but keep the proof of concept simple.

## Domain glossary

- **NICE:** National Institute for Health and Care Excellence. It publishes guidelines, and each guideline is made up of numbered recommendations.
- **Baseline assessment:** A Trust's self-assessment of whether it meets each recommendation in a guideline.
- **Trust:** An NHS organisation. In the new architecture, each Trust is a separate tenant.
- **Group:** A set of Trusts that work together under a group model and have agreed (through a DPIA) to share non-patient data. A group sits above its Trusts. Each Trust stays a separate tenant.
- **Action plan:** The list of relevant recommendations that the Trust does not fully meet, with owners and deadlines.
- **Clinical audit:** A measurement of actual practice against defined standards. A baseline assessment records what a Trust *says* it does. A clinical audit *measures* what it does. An audit design has criteria, a target %, exceptions, a data source, a sample and a data collection tool (proforma).

## Business rules (must stay the same)

- **One assessment per recommendation:** `assessments.rec_id` is UNIQUE (it becomes unique per tenant in the multi-tenant version).
- **Compliance %:** `(count of Met = Yes) / (count of Relevant = Yes) * 100`.
  - Only recommendations where `Relevant = Yes` count towards the denominator.
  - `Met = Partial` does **not** count as met.
  - If no recommendations are relevant, show the result as "N/A" or 0%. Never divide by zero.
- **Action plan:** Every recommendation where `Relevant = Yes` AND `Met` is `No` or `Partial`.
- **Auto-save:** Save the answers each time the user moves between recommendations (Next/Previous). A user must be able to leave and come back months later without losing any data.
- **NICE text is read-only:** Users can never edit the recommendation text in the assessment UI.

## Data model (current schema, use as the starting point)

- `guidelines`: `id`, `name`
- `recommendations`: `id`, `guideline_id`, `rec_text`, `guideline_rec`, `rec_year`
- `assessments`: `id`, `rec_id` (UNIQUE), `relevant`, `evidence`, `meet`, `action`, `risk`, `cost`, `capacity`, `deadline`, `lead`, `completed_by`
- Views: `compliance_summary` and `action_plan`. These views are used for PowerBI/Excel extraction. Keep equivalent reporting outputs in any new database.

When you migrate the schema:
- Add a tenant/Trust key to every table that holds Trust data.
- Add tables for Trusts and groups. A Trust belongs to zero or one group. Trusts and groups are configuration data, so do not hard-code them.
- Keep the data relational. Do not duplicate recommendation text into assessments.

## UX requirements (do not regress)

- **Wizard flow:** Show one recommendation at a time, with a progress indicator and Next/Previous navigation.
- **Side-by-side layout:** The NICE recommendation stays fixed on the left. The assessment form is on the right.
- **Excel upload / Central Guidance:** Rather than end-users uploading spreadsheets, the tool ships with a centrally managed database of all NICE guidance. Administrators ingest NICE updates (via Excel or API) globally. Trusts automatically see new or updated recommendations appear in their assessments, shifting the burden of updating BATs away from the clinicians.
- **Live report:** A "View Report" dashboard shows the Compliance % and the generated action plan.

## NHS constraints

- **Multi-tenancy is a security requirement:** By default, a user sees only their own Trust's data. Trust A must never be able to see Trust B's data. Apply tenant isolation on the server side for every query. Never rely on the frontend for it.
  - **Group exception:** A user with an explicit group-level role (for example a group audit or governance lead) can view the data of every Trust in *their own* group. Grant this role deliberately, check it on the server side, and log cross-Trust access. Group roles never give access to Trusts outside the group.
- **Authentication:** Use NHS SSO / Microsoft Entra ID (Azure AD). Do not build custom username/password storage unless the user asks for it.
  - The group's Trusts are part-way through moving to shared IT. Some users may sign in from a shared Entra ID tenant and some from a Trust's own tenant. Support more than one Entra ID tenant, with an allow-list of approved tenants.
  - Work out a user's Trust and role from configuration in the app (for example Entra ID group membership or an admin-managed user list). Do not work it out only from the Entra ID tenant or the email domain, because these can change during the IT merger.
- **No patient data, ever:** This tool never collects patient data. That includes clinical audit data. It holds only organisational governance data (assessments, action plans, audit designs) and aggregate audit results. Do not add fields, uploads or features that collect patient-level or patient-identifiable data.
- **Accessibility:** Aim for WCAG 2.2 AA. Clinicians use a range of devices and assistive technologies.
- **Language:** Use UK English in the UI, docs and comments (for example "organisation", "prioritise").

## Future direction: AI assistance (not yet in scope)

The user wants AI to help reviewers assess, measure and report compliance. The ideas so far:
- **Cross-Trust themes:** Analyse recorded actions for themes and offer them as guidance to users at other Trusts.
- **Clinical audit design:** Help professionals design ways to measure their current practice against a recommendation. This means drafting audit criteria, targets, exceptions, data sources, sampling and a data collection proforma. This links the baseline assessment to the audit cycle: assess → audit → act → re-audit.
- **Bespoke audit and analysis tools:** Generate data collection tools and statistical analysis templates for each NICE recommendation (for example sample size, confidence intervals, comparison between audit cycles, run charts or SPC charts). Trusts use these tools in their own systems, on their own data. Only the aggregate results come back into this tool.

These features are not designed yet. Do not build them unless the user asks. Design the core so these features can be added later.

When AI features are in scope, follow these rules:
- **Cross-Trust insights do not break tenant isolation.** Never let one Trust read another Trust's tenant tables. Keep shared insights in a separate store. That store holds only aggregated, de-identified content that has been approved.
- **Shared insights need safeguards:** Trusts opt in. Remove names and roles (`lead`, `completed_by`) and any other identifying free text. Only publish a theme when it comes from enough Trusts that no single Trust can be identified. A person reviews the content before it is shared.
- **Human in the loop:** AI can suggest answers (relevance, evidence gaps, draft actions, audit designs, report narrative). A user must confirm every suggestion. Show clearly which content the AI generated.
- **Ground AI output in source material:** Base suggestions on the NICE recommendation text and, if available, the related NICE quality standard measures. Show the source. Do not present AI output as NICE guidance.
- **Audit designs, not patient data:** The tool helps *design* an audit and records aggregate results only (numerator, denominator, exclusions). It never collects patient-level or patient-identifiable audit data. Generated tools must make it clear that patient data stays in the Trust's own systems.
- **The calculations stay deterministic:** The AI never calculates the compliance %, audit results or statistics, and never selects the action plan. Those come from the business rules and the recorded data.
- **Statistics come from tested code:** Put statistical methods (for example sample size and confidence intervals) in reviewed, tested code. Do not let an LLM generate them at run time. AI can suggest which method suits an audit and explain the results in plain English, but the numbers come from code.
- **Information governance:** Before you choose an AI provider, confirm it with the user. It must have UK data residency, must not train on Trust data, and must be acceptable to NHS IG (a DPIA and a DTAC assessment are likely). Also check NICE's licence terms for using its content with AI.

## Working conventions for the agent

- **Tech stack:** 
  - **Frontend:** React (Vite) with TailwindCSS and SheetJS (for in-browser Excel parsing).
  - **Backend:** Python FastAPI using SQLAlchemy (ORM).
  - **Database:** PostgreSQL.
  - **Auth:** MSAL (Microsoft Authentication Library) for Entra ID integration.
- **Keep it simple:** Prefer simple, maintainable solutions. The original tool succeeded because it was easy to deploy and easy to use.
- **No secrets or data in the repo:** Never commit secrets, connection strings, or database files (`*.db`).
- **Tests:** When you implement business rules (compliance calculation, action plan selection, tenant isolation, group-level access) or statistical methods, add tests for them, including edge cases. Tenant tests must prove that a group role cannot reach Trusts outside its group. Check statistical results against published reference values.