# INCUBEIN Cohort Evaluator - Technical Documentation

The Cohort Evaluator is a secure, automated decision-support system designed to ingest, process, evaluate, and rank startup applications for the **INCUBEIN Startup Program**. It balances data security (PII field-level encryption) with computational utility (unencrypted fields for analytics and evaluation).

---

## 1. System Architecture

```text
Excel Upload (.xlsx)
      ↓
FastAPI Parsing
      ↓
┌───────────────────────────┴───────────────────────────┐
▼                                                       ▼
Encrypt Sensitive Fields (AES-256)             Extract Analytic Fields (Non-PII)
(Name, Email, Mobile, Address, DOB)           (Sector, Stage, Revenue, DPIIT, Summary)
      │                                                 │
      ▼                                                 ▼
MongoDB Persistence                              Scoring & Evaluations
(incubein_applications)                         1. Rule Engine Score (max 40)
      │                                         2. Gemini LLM Review (max 100)
      │                                         3. Similarity Matrix (TF-IDF Cosine Sim)
      │                                                 │
      ▼                                                 ▼
      ├─────────────────────────────────────────────────┘
      ▼
On-the-Fly Decryption (Admin View)
      ↓
React Cohort Dashboard
```

---

## 2. PII Field-Level Encryption

To comply with data privacy best practices, sensitive fields are encrypted prior to being stored in MongoDB.
- **Symmetric Encryption**: Uses **AES-128/256** in CBC mode via Python's `cryptography.fernet.Fernet`.
- **Environment Key**: The key is stored in the `.env` configuration file as `ENCRYPTION_KEY`.
- **On-the-fly Decryption**: When the admin requests the list of applications, the FastAPI backend decrypts these fields on-the-fly and sends them to the frontend, ensuring database breaches do not compromise contact details.
- **Encrypted Fields**:
  - `Name (First Middle Last)`
  - `Email address`
  - `Mobile Number`
  - `Alternet Mobile Number`
  - `Date of Birth`
  - `Address`

---

## 3. Evaluation Pipeline

Each startup is scored out of **100 points** based on a weighted combination of Rule-based parameters (40% weight) and Gemini LLM analysis (60% weight).

### 3.1 Rule Engine (40% Weight)
The Rule Engine evaluates objective parameters from the application sheet (max 40 raw points):
1. **Revenue Score** (max 10 pts):
   - 0 points: ₹0 revenue
   - 5 points: $\le$ ₹5 Lakhs
   - 8 points: $\le$ ₹20 Lakhs
   - 10 points: $>$ ₹20 Lakhs
2. **Stage Score** (max 10 pts):
   - 10 points: Early Traction, Growth, Scaling, Revenue
   - 8 points: MVP
   - 6 points: Prototype
   - 4 points: Idea / Concept
3. **DPIIT Registration** (max 5 pts):
   - 5 points: Registered (provides DPIIT number)
   - 0 points: Not registered
4. **Team Size Score** (max 5 pts):
   - 5 points: $\ge$ 5 members
   - 4 points: 2 to 4 members
   - 2 points: Single founder
5. **Website Score** (max 5 pts):
   - 5 points: Valid website URL present
   - 0 points: None
6. **Pitch Deck Score** (max 5 pts):
   - 5 points: Presentation link/attachment present
   - 0 points: None

*Formula*: $\text{Rule Score} = (\text{Raw Points} / 40) \times 100$

### 3.2 AI LLM Evaluation (Disabled)
The AI LLM evaluation has been disabled for startups to prioritize deterministic, objective scoring criteria and avoid latency.

### 3.3 Final Score & Ranking
$$\text{Final Score} = \text{Rule Score}$$

Startups are ordered by their `Final Score` descending to assign cohort ranks ($1 \dots N$).


---

## 4. Similarity Indexing (Duplicate Detection)

To find copycats or duplicate submissions:
1. **Local TF-IDF Vectorization**: Parses business summaries into word frequencies.
2. **Cosine Similarity**: Computes pairwise correlation matrices.
3. **Flagging Threshold**: Pairs with a similarity score $\ge 40\%$ are logged, and scores $\ge 80\%$ trigger a high-visibility warning indicator on the dashboard.

---

## 5. UI Features

Access the **Cohort Evaluator** tab on the sidebar to:
- **Upload sheets**: Drag-and-drop Excel files to instantly trigger the scoring pipeline.
- **Filter and search**: Query candidates by sector, stage, final score, and keyword.
- **Inspect details**: Click on any startup to view its full profile, decrypted contact information, score breakdown, Gemini recommendation, and duplicate notifications.
