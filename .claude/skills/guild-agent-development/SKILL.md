---
name: guild-agent-development
description: Build, test, and publish Guild agents using the Guild CLI and Agent SDK. Use when the user asks to create or modify Guild agents, choose between llmAgent/auto-managed/self-managed state, configure agent schemas/tools, run guild CLI workflows, inspect sessions/triggers, or troubleshoot Guild agent development.
---

# Guild Agent Development

Use this skill to implement and operate Guild agents quickly and safely.

## Quick Triage

Start by identifying the user intent:

1. Build a new agent
2. Modify an existing agent
3. Run/test/debug an agent
4. Publish/manage versions
5. Configure workspace, context, sessions, or triggers

Then pick the smallest workflow below that satisfies the request.

## Core Mental Model

Guild is a control plane for agents:

- Workspaces contain agents, triggers, context, and credential policy.
- Sessions are execution logs for a run.
- Agent runs flow through `guildcore` into runtime, which executes tools/LLM calls and returns output.

Use this vocabulary consistently: workspace, agent, session, trigger, context.

## Agent Type Selection

Choose type before writing code:

- Use `llmAgent` for prompt-plus-tools workflows.
- Use auto-managed state (`"use agent"` + `run`) for deterministic sequential TypeScript logic with minimal boilerplate.
- Use self-managed state (`start`/`onToolResults`) for parallel tool calls or complex state loops.

Decision table:

| Need | Best type |
| --- | --- |
| Fastest to ship, prompt-driven behavior | `llmAgent` |
| Deterministic sequential algorithm | Auto-managed state |
| Parallel tool calls (`callTools([...])`) | Self-managed state |
| Full explicit state control | Self-managed state |

## Runtime Constraints (Important)

For Guild agent runtime code:

- Only rely on `@guildai/agents-sdk`, `zod`, and `@guildai-services/*`.
- Do not rely on arbitrary npm dependencies or Node built-ins.

For auto-managed state (`"use agent"`):

- Do not use `Promise.all`, `Promise.any`, or `Promise.race` for tool-call orchestration.
- Avoid dynamic function-reference patterns that cross `await` boundaries.

If those are required, switch to self-managed state.

## CLI Setup Workflow

When environment setup is needed, run this order:

```bash
npm install -g @guildai/cli
guild --version
guild auth login
guild auth status
guild workspace select
guild workspace current
guild doctor
```

If user wants coding-assistant integration in a project:

```bash
guild setup
```

## New Agent Workflow (CLI)

Use this sequence:

```bash
guild agent init --name <agent-name>
guild agent test
guild agent save --message "<clear change summary>" --wait
guild agent publish --wait
```

Useful variants:

```bash
guild agent init --template LLM
guild agent init --template AUTO_MANAGED_STATE
guild agent init --fork <agent-id>
guild agent chat
guild agent pull
```

Templates:

- `LLM` (default)
- `AUTO_MANAGED_STATE`
- `BLANK`

## Agent Schema Checklist

Every agent should define:

- `description`
- `inputSchema` (Zod)
- `outputSchema` (Zod)
- `tools` (if needed)

For self-managed state, also define:

- `stateSchema`
- `start(input, task)`
- `onToolResults(results, task)`

## LLM Usage in Agents

Use `task.llm.generateText()` for LLM calls.

Guidelines:

- Keep prompts specific and single-purpose.
- Cache result objects if reused.
- Use Zod `schema` for structured outputs rather than parsing free text.
- Do not hardcode provider/model in code; workspace config handles that.

## Self-Managed State Loop

Use this pattern:

1. `start`: validate input, `task.save(state)`, return `output(...)` or `callTools([...])`
2. runtime executes tools
3. `onToolResults`: `task.restore()`, handle tool errors, continue with `callTools([...])` or finish with `output(...)`

Use `ask(prompt)` when you need an interactive user response via `ui_prompt`.

## Error Handling Rules

- Auto-managed: wrap `run` internals with `try/catch`, rethrow clear error messages.
- Self-managed: inspect `results` for tool errors (`"error" in result`) and throw explicit failures.
- Prefer errors that include failing tool name and actionable context.

## Session and Trigger Operations

Use these CLI commands for diagnostics and automation:

```bash
guild session list
guild session get <session-id>
guild session events <session-id>
guild session tasks <session-id>
guild session send <session-id> "<message>"
```

```bash
guild trigger list
guild trigger create --type webhook --service SLACK --event app_mention --agent <identifier>
guild trigger create --type time --frequency DAILY --time 09:00 --agent <identifier>
guild trigger update <trigger-id> --time 10:00
guild trigger activate <trigger-id>
guild trigger deactivate <trigger-id>
```

## Workspace and Context Operations

```bash
guild workspace list
guild workspace create <name>
guild workspace get <identifier>
guild workspace select <id-or-name>
guild workspace agent list
guild workspace agent add <identifier>
guild workspace agent remove <identifier>
guild workspace context list <workspace-id>
guild workspace context edit <workspace-id>
guild workspace context publish <workspace-id> <context-id>
```

## Working Style for Agent Tasks

When implementing Guild agent requests:

1. Confirm agent type choice.
2. Draft/adjust schemas before business logic.
3. Add minimal required tools (use selective tool picking when possible).
4. Implement run-loop logic.
5. Test with `guild agent test` and/or `guild agent chat`.
6. Save with a descriptive message.
7. Publish only when user requests release.

## Common Gotchas

- Missing `"use agent"` in auto-managed files.
- Attempting parallel tool orchestration in auto-managed code.
- Over-broad toolsets instead of selected tool subsets.
- Skipping workspace selection and getting confusing command behavior.
- Forgetting `guild doctor` when auth/workspace config seems inconsistent.
