# NEEDED.md — Ulanganku Upgrade Requirements

## 1. Task and Objective

You are a senior full-stack engineer, AI integration specialist, and UI/UX designer.

Inspect, improve, and extend the existing **Ulanganku** web application. Do not rebuild the project from scratch. Work with the existing codebase, architecture, database, authentication, API routes, and deployment configuration.

### Main goals

- Improve the chatbot UI and user experience.
- Upgrade the AI chatbot to generate varied exam question types based on teacher instructions.
- Add a model selector using the available Ollama Cloud models.
- Support generating 100 or more questions when requested and technically feasible.
- Add exam preview to the exam editor.
- Build a complete exam template system with at least 20 built-in templates.
- Allow teachers to create, customize, publish, and manage public or private templates.

Do not stop after writing a plan. Inspect the project, implement the changes, run tests, fix errors, and verify the results.

---

## 2. Inspect the Existing Project First

Before making changes:

1. Inspect the project structure and existing documentation.
2. Identify the frontend framework, backend architecture, database, ORM, authentication, and deployment platform.
3. Locate the chatbot UI, AI integration, exam editor, question schema, database schema, and exam routes.
4. Inspect environment variable names and configuration without exposing secret values.
5. Identify existing bugs, incomplete functionality, and compatibility risks.
6. Review the current UI and preserve its design language where practical.

Create a concise implementation plan based on the actual codebase, then proceed with implementation.

### Safety and compatibility rules

- Preserve all working features.
- Do not replace the current technology stack unless necessary.
- Reuse existing components, routes, and database tables where appropriate.
- Avoid unnecessary dependencies and breaking changes.
- Use database migrations for schema changes.
- Never hardcode API keys or expose server-side secrets in browser code.
- Do not use fake API responses or leave nonfunctional placeholder buttons.
- Do not claim a feature works unless it has been implemented and verified.

---

## 3. Chatbot UI Improvements

Redesign the chatbot interface to be clean, modern, responsive, and easy for teachers to use.

### Requirements

- Improve spacing, alignment, typography, and visual hierarchy.
- Make the message composer clear and comfortable to use.
- Place a model selector inside or next to the chat input area, similar to ChatGPT.
- Display the currently selected model.
- Allow model switching without leaving the chatbot.
- Show loading and generation progress states.
- Show useful, actionable error messages when requests fail.
- Support long conversations and long AI responses.
- Prevent accidental duplicate submissions.
- Provide accessible keyboard navigation and visible focus states.
- Ensure usability on mobile, tablet, and desktop.
- Follow the existing design system; avoid excessive shadows, gradients, or decorative effects.

---

## 4. AI Chatbot — Flexible Exam Generation

The chatbot must generate exams based on natural-language instructions, not just multiple-choice questions.

### 4.1 User instructions and exam settings

Teachers should be able to request an exam in ordinary language, for example:

> Create a Grade 8 mathematics exam about linear equations with 40 questions: 20 multiple choice, 10 short answer, 5 essay, and 5 true-or-false. Set intermediate difficulty and a 90-minute time limit.

Support, where relevant:

- Subject or course.
- Grade/class level.
- Topic or chapter.
- Curriculum or learning objectives.
- Total number of questions.
- Question types and distribution.
- Difficulty.
- Exam duration.
- Language.
- Student instructions.
- Points and scoring.
- Answer key.
- Answer explanations.
- Additional teacher-specific requirements.

If an essential detail is missing, ask a concise clarification or use a reasonable assumption and make it visible to the teacher.

### 4.2 Supported question types

Implement support for:

1. Multiple choice.
2. Multiple select.
3. True or false.
4. Short answer.
5. Fill in the blanks.
6. Essay/long-form response.
7. Matching.
8. Ordering/sequencing.
9. Numerical answer.
10. Reading comprehension with shared passages.
11. Questions using tables, formulas, or structured data where appropriate.

Use a structured question schema compatible with the existing exam editor and student test-taking interface. Do not force every type into a multiple-choice structure.

Each question should support the fields appropriate to its type, such as:

- Question text.
- Answer options, where applicable.
- Correct answer or grading rubric.
- Explanation, when requested.
- Points.
- Optional image, passage, or supporting data.
- Question-specific metadata.

Implement automatic grading for supported objective question types. Subjective questions such as essays should support manual grading with a rubric. AI-assisted grading may be added if compatible with the existing architecture, but it must not silently replace teacher review.

### 4.3 Automatic exam duration

- Respect a duration explicitly specified by the teacher.
- If the teacher requests automatic duration, estimate it based on question count, question types, complexity, and expected response time.
- If no duration is provided, suggest a reasonable default based on the exam content.
- Allow the teacher to review and edit the duration before publishing.
- Never overwrite an explicitly configured duration without permission.

### 4.4 Generating 100+ questions

Support 100 or more questions when requested and technically feasible.

- Do not impose arbitrary application limits such as 10, 20, or 50 questions.
- Validate requests against real provider and system limits.
- Account for context-window and output-token limits.
- Generate in batches when one request cannot reliably return the full exam.
- Track batch progress and failures.
- Merge batches in the correct order.
- Detect duplicate or near-duplicate questions across batches.
- Validate the final question count against the requested count.
- Allow retrying failed batches without regenerating successful batches.
- Save results safely and prevent accidental data loss.
- Clearly report partial completion or provider limits.

Never claim that the requested number of questions was generated unless the saved question records have been validated.

### 4.5 Structured output and validation

Use structured JSON or another machine-readable format suitable for the existing backend.

Implement:

- Schema and required-field validation.
- Question-type and answer validation.
- Point and duration validation.
- Safe parsing and error recovery.
- Bounded retries for malformed output.
- Duplicate detection.
- Server-side validation before saving.

Do not rely only on prompt instructions to ensure valid output. Generated exams must remain editable before publication.

---

## 5. Ollama Cloud Model Selector

Integrate a model selector into the chatbot interface.

### Requirements

- Retrieve and display the models actually available through the configured Ollama Cloud integration.
- Allow teachers to select their preferred model.
- Show the selected model in the chat composer.
- Use that model for subsequent chatbot requests.
- Persist the selection across navigation or sessions if supported by the existing application.
- Provide a sensible default model.
- Handle unavailable models, timeouts, rate limits, and authentication errors.
- Validate the selected model on the server.
- Keep provider credentials server-side.
- Avoid exposing secrets in browser code or error messages.

### Model discovery

Inspect the existing integration and supported Ollama Cloud API capabilities first.

Use the supported model-list endpoint or a maintainable configuration mechanism. Do not assume every model is available to every account and do not invent model identifiers.

If a complete model list cannot be retrieved through the available API, implement a maintainable fallback configuration and document the limitation.

Preserve existing AI integrations unless replacing one is necessary and justified.

---

## 6. Exam Preview in the Editor

Add a clearly visible **Preview Exam** action to the existing exam editor.

### Requirements

- Preview an exam before publishing it.
- Render questions in a layout similar to the student exam-taking experience.
- Correctly render every supported question type.
- Display title, description, instructions, and duration.
- Render answer choices, passages, formulas, tables, and other supported content.
- Provide question navigation, question numbers, and progress indicators.
- Support mobile and desktop.
- Provide a clear way to return to editing.
- Preserve unsaved edits where practical.
- Do not accidentally submit answers, publish the exam, or change student records.
- Preview the current editor state, including unsaved changes.

If appropriate, provide separate teacher preview and student-like preview modes.

---

## 7. Exam Template System

Build a reusable template system that lets teachers browse templates, use them to create exams, and create their own templates.

### 7.1 At least 20 built-in templates

Provide at least **20 meaningful, distinct, ready-to-use templates** covering multiple subjects and grade levels.

Include a suitable selection from:

- Mathematics.
- Indonesian language.
- English.
- Science.
- Social studies.
- Civics.
- History.
- Geography.
- Biology.
- Physics.
- Chemistry.
- Informatics/computer science.
- Economics.
- Religious or moral education, where appropriate.
- Elementary, middle, and high school.
- Vocational education.

Templates should contain useful defaults such as subject, grade, question types and distribution, recommended question count, difficulty, duration, and instructions. Avoid creating 20 copies of a generic template.

Seed built-in templates through a maintainable mechanism compatible with the existing database and deployment process. Ensure they are immediately usable, editable, and compatible with the exam generator and editor.

### 7.2 Template discovery page

Create a template discovery page at:

`/template`

Teachers should be able to:

- Browse available templates.
- Search by template name.
- Filter by subject, grade/class, and relevant categories.
- Open template details.
- Preview a template.
- Use a template to start creating an exam.
- Edit settings derived from a template before saving or publishing.

Ensure the page is responsive and accessible.

### 7.3 Teacher-created templates

Allow authenticated teachers to create their own templates.

Support appropriate fields such as:

- Template name.
- URL slug.
- Description.
- Subject.
- Grade/class level.
- Category.
- Default question types and distribution.
- Default question count.
- Default duration.
- Difficulty.
- Exam instructions.
- Optional reusable question content.
- Visibility.
- Publication status.
- Owner/creator.
- Creation and update timestamps.

Reuse existing exam structures when practical rather than duplicating data unnecessarily.

Teachers should be able to:

- Create a template.
- Edit their templates.
- Duplicate a template.
- Publish or unpublish a template.
- Change visibility.
- Delete their own templates when permitted.
- Preview a template.
- Copy/open its URL.
- Use a template to create an exam.

Validate all inputs on the server and enforce ownership permissions.

### 7.4 Routes and URL slugs

Implement routes using the conventions of the existing framework:

- `/template` — template discovery.
- `/template/[slug]` — individual template details.
- Appropriate authenticated teacher pages and API endpoints for template management.

Example URL:

`https://ulanganku.vercel.app/template/matematika-kelas-8`

Requirements:

- Generate a default slug from the template name.
- Allow teachers to customize the slug.
- Validate slug format and uniqueness.
- Handle duplicate slugs gracefully.
- Build absolute URLs from the application's configured base URL.
- Do not hardcode the production domain throughout the codebase.
- Reuse the existing public URL configuration or an appropriate environment variable.
- Where feasible, preserve old links using slug history or redirects when a slug changes.

### 7.5 Public and private templates

**Public templates**
- Appear on `/template`.
- Can be viewed by users permitted under the application's access model.
- Can be reused by other teachers.
- Display appropriate template details.

**Private templates**
- Are visible only to the owner and authorized administrators.
- Do not appear in public listings or public search results.
- Cannot be accessed through direct URLs or API requests by unauthorized users.

Enforce access control on the server, not only in the frontend. Follow the application's existing role and authorization model.

### 7.6 Template management UI

Create a clear management interface for teachers, including:

- Their template list.
- Public/private visibility.
- Published/unpublished status.
- Edit and delete actions.
- Copy/open URL action.
- Useful empty states and error handling.
- Confirmation before destructive actions.

Never leak private templates through public APIs, search indexes, or unauthenticated endpoints.

---

## 8. Database and Backend

Inspect the current database schema and make the smallest safe set of changes necessary.

Extend or add models for:

- Multiple question types.
- Exam duration and grading configuration.
- Template metadata.
- Template ownership.
- Visibility and publication status.
- Template slugs and uniqueness constraints.
- Optional slug history.
- AI generation jobs or batches, if needed.

Requirements:

- Preserve existing exam records and user data.
- Add migrations compatible with the current database and deployment workflow.
- Add appropriate indexes and uniqueness constraints.
- Use transactions where needed to avoid partially saved exams or templates.
- Validate all user input on the server.
- Enforce authentication, authorization, ownership, and visibility rules.
- Handle API errors consistently.
- Avoid N+1 queries and unnecessary database calls.
- Make long-running AI generation resilient to timeouts and serverless execution limits.
- Never store provider secrets in exam or template records.

Do not introduce a new database or ORM unless the existing setup genuinely cannot support the requirements.

---

## 9. Security, Reliability, and Performance

- Validate all incoming API data.
- Protect authenticated routes and mutation endpoints.
- Enforce template ownership and privacy server-side.
- Prevent unauthorized access to private templates and exams.
- Add rate limits or reasonable safeguards to expensive AI generation endpoints where appropriate.
- Handle provider errors, network failures, timeouts, and malformed AI responses.
- Avoid duplicate requests and duplicate database writes.
- Keep secrets in environment variables.
- Avoid logging API keys, tokens, or sensitive user data.
- Ensure the implementation is compatible with the existing deployment platform.
- Avoid adding unnecessary heavy dependencies.
- Ensure loading, empty, success, and error states exist for major workflows.

---

## 10. Testing and Verification

After implementation, run the checks supported by the project.

At minimum, verify:

### Chatbot and AI
- Chat UI works on desktop and mobile.
- Model selection updates the actual backend model.
- Provider failures produce useful errors.
- Different question types are generated and saved correctly.
- Requested question counts are validated.
- Batch generation handles partial failures and retries.
- Explicit exam duration is preserved.
- Invalid AI output does not corrupt stored exams.

### Exam preview
- Preview opens from the editor.
- All supported question types render correctly.
- Unsaved edits are reflected in preview.
- Returning to the editor preserves edits.
- Preview does not publish or submit an exam.

### Templates
- At least 20 built-in templates are available.
- Search and filters work.
- Teachers can create, edit, duplicate, publish, unpublish, and delete their own templates as authorized.
- Public templates are discoverable and reusable.
- Private templates are not exposed to unauthorized users.
- Slug uniqueness and validation work.
- Direct routes and API endpoints enforce access rules.
- Templates can be used to create editable exams.

### Regression and deployment
- Existing authentication still works.
- Existing exam creation and editing still work.
- Student exam-taking and grading flows remain functional.
- Existing routes and APIs are not unintentionally broken.
- Database migrations run successfully.
- Build, lint, type checks, and tests pass where configured.
- Fix any errors introduced by your changes.

If a test cannot be run because a service or credential is unavailable, state exactly what was blocked. Do not claim it passed.

---

## 11. Implementation Workflow

Follow this workflow:

1. Inspect the project and identify existing conventions.
2. Summarize the current architecture and implementation plan.
3. Implement database/schema changes and migrations.
4. Implement backend services and API routes.
5. Implement the chatbot UI and Ollama Cloud model selector.
6. Implement structured multi-type question generation and batch processing.
7. Implement exam preview.
8. Implement the built-in and teacher-created template system.
9. Integrate authorization, validation, error handling, and responsive UI.
10. Run tests, build, lint, and type checks available in the project.
11. Fix regressions and implementation errors.
12. Review the final changes for security and deployment compatibility.
13. Report completed work, files changed, environment variables required, migrations, tests run, and any remaining limitations.

Prioritize correctness and integration over rushing to add many superficial components.

If the full task is too large for one pass, divide it into logical phases, complete each phase carefully, and keep the application in a working state between phases. Do not silently omit requirements.

---

## 12. Final Deliverables

At completion, provide:

1. A summary of implemented features.
2. A list of important files created or modified.
3. Database migration and seeding instructions.
4. Any required environment variable names, without revealing secret values.
5. Build, test, lint, and type-check results.
6. Any manual setup required for Ollama Cloud.
7. Any remaining limitations, with clear reasons.
8. Deployment instructions appropriate to the existing project.

**Definition of done:** The requested features are implemented in the existing Ulanganku project, integrated with its real backend and database, protected by appropriate access controls, responsive, and verified as far as the available environment permits.
