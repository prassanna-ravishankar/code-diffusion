# Code Diffusion

Autonomous multi-agent development system that transforms high-level feature requests into working code through progressive refinement.

## Overview

Code Diffusion is inspired by diffusion models and uses a three-stage progressive refinement architecture:

1. **Bootstrapper** (exploration) - Broad exploration, multiple approaches considered
2. **Planner** (structuring) - Structured decomposition, decisions crystallized
3. **Implementer** (execution) - Deterministic code generation in parallel worktrees

## Features

- Progressive refinement through three distinct stages
- Notion-based coordination and state management
- Dynamic subagent orchestration
- Git worktree management for parallel development
- Multi-repository support
- Skills-based agent configuration

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with required credentials:

```
NOTION_API_KEY=your_notion_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Development

```bash
# Start development server
npm run dev

# Build project
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Project Structure

```
code-diffusion/
├── src/
│   ├── agents/          # Agent implementations
│   ├── orchestration/   # Orchestration server
│   ├── services/        # Core services (Notion, Git, etc.)
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── tests/               # Test files
├── config/              # Configuration files
└── docs/                # Documentation
```

## License

MIT
