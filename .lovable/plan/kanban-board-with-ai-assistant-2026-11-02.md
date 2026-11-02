# Kanban Board with AI Assistant

## What you'll get
- **Sign-in page** (email + password). Each person sees only their own board.
- **Board page** with two columns: **To Do** and **In Progress**.
  - Cards show a coloured category tag, title, short description, progress bar, due date.
  - Drag and drop cards between columns and reorder within a column.
  - Add, edit and delete cards (pop-up form).
  - Search box to filter cards.
- **AI assistant panel** on the right (one ongoing conversation, saved to your account):
  - Answers questions about your tasks ("What's due this week?").
  - Gives productivity advice.
  - Can create cards and move them between columns; the board updates instantly.
- Everything saves automatically to Lovable Cloud, so it's there when you come back.

## Design (blend of both references)
- Soft light-grey backdrop with a large rounded white app frame and subtle shadows.
- Slim deep-indigo icon sidebar (from reference 2) with the logo, board, and sign-out.
- Big bold board title, tabbed header, warm orange primary buttons and accents (reference 1), with purple as a secondary accent for progress bars.
- Pastel category tags (orange, green, purple, blue, pink), rounded cards, tilted "lifted" card effect while dragging, dashed drop-zone placeholder.
- Right panel: a small stats block (total / to do / in progress, progress ring) above the AI chat.
- Typography: a geometric display font (e.g. Plus Jakarta Sans / Sora), not Inter.

## Technical details
- Enable Lovable Cloud; email auth on. Tables: `tasks` (user_id, title, description, category, status `todo|in_progress`, position, progress, due_date) and `chat_messages` (user_id, role, parts JSON), both with GRANTs + RLS scoped to `auth.uid()`.
- Routes: `/` landing/redirect, `/auth`, `/_authenticated/board`.
- dnd-kit for drag and drop; TanStack Query for task data with optimistic updates.
- AI: streaming server route using AI SDK + Lovable AI Gateway (default model, Responses API), with tools `list_tasks`, `create_task`, `move_task`, verified against the signed-in user. AI Elements for the chat UI. Messages persisted in `onFinish`; board refetches after tool calls.
- Handle 402/429 errors with friendly messages in the chat.
