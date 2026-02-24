# Agentic Skill: Git & GitHub CLI (`gh`) Operations

## Core Philosophy for Autonomous Execution
When operating Git and the GitHub CLI (`gh`), you are interacting with persistent, shared state. You must adhere to these strict rules to prevent lockups, infinite loops, and merge conflicts:
1.  **Never Assume a Clean Slate**: Always assume previous runs may have crashed. Use hard resets before checking out branches.
2.  **Never Use Interactive Commands**: Commands must execute entirely via standard input/output. Never allow Git to open a text editor (e.g., always use `git commit -m`).
3.  **The "Last Word" Protocol**: Always use your own GitHub comments as state checkpoints to prevent repeating the same work.
4.  **Parallel Safety via Worktrees**: Never modify files in the base repository clone. Always use `git worktree` to isolate parallel tasks.


---

## 1. Architectural Setup: Base Repositories vs. Worktrees
To support concurrent agent tasks without locking errors, you must separate the Git database from the working files.

* **Base Repository** (`/root/<repo_name>`): Used *only* to hold the `.git` database. You never write code here.
* **Isolated Worktrees** (`/root/worktrees/<repo_name>/<branch_name>`): Dedicated directories for specific PRs or features. 

### Creating and Managing Worktrees
```bash
# 1. Always fetch the latest remote state first from inside the Base Repo
cd /root/<repo_name>
git fetch origin <branch_name>

# 2. Create a new branch and worktree simultaneously
git worktree add -b <new_branch> /root/worktrees/<repo_name>/<new_branch> origin/main

# 3. Create a worktree for an existing branch
git worktree add /root/worktrees/<repo_name>/<existing_branch> <existing_branch>

# 4. Clean up a worktree when the PR is merged/closed
git worktree remove /root/worktrees/<repo_name>/<branch_name> --force
```

---

## 2. Idempotent State Recovery (The "Clean Slate" Sync)
If you are waking up or resuming a session, the worktree might be in a dirty or conflicted state. You must force it back to a clean state matching the remote branch before writing new code.

```bash
cd /root/worktrees/<repo_name>/<branch_name>

# Nuke any uncommitted, modified, or staged files
git reset --hard HEAD
git clean -fd

# Safely pull the absolute latest changes from the remote
git pull origin <branch_name>
```

---

## 3. GitHub CLI (`gh`) for Agentic Context
Use `gh` to read the environment, establish your identity, and build a timeline of events.

### Identity & Verification
Before acting, you must know your own username so you can recognize your own comments.
```bash
# Retrieve your bot's authenticated username
gh api user -q .login
```

### Reading PR State & Feedback
To prevent infinite loops, you must fetch the state, the reviews, and the inline comments simultaneously to build a timeline.



```bash
# Get the high-level PR state (Merge status, Base/Head info)
gh pr view <URL> --json state,headRepositoryOwner,headRepository,headRefName

# Get general conversation and formal reviews
gh pr view <URL> --json comments,reviews

# Get inline code comments with timestamps and authors mapped via jq
gh api repos/<owner>/<repo>/pulls/<number>/comments --jq '.[] | "[\(.created_at)] \(.user.login) on File \(.path) (Line \(.line)): \(.body)\n---"'
```

### Checking CI Status (Continuous Integration)
Before pushing new fixes or declaring a task complete, verify the CI pipeline.
```bash
# Outputs a clean table of passing/failing checks
gh pr checks <URL>
```
*Agentic Rule*: If checks fail, attempt to reproduce them locally in your worktree (`npm test`, `pytest`) before pushing a fix. If you attempt 3 fixes and CI still fails, **STOP** and request human assistance to prevent an infinite loop.

---

## 4. Safe Pushing & Conflict Resolution
When multiple humans and agents work on a PR, your `git push` may be rejected if the remote branch moved ahead while you were working.

### The Rebase-Push Workflow
Never force push (`--force`) unless explicitly commanded. Use `--rebase` to replay your automated commits cleanly on top of the human's new commits.

```bash
# Standard push (assumes tracking is set up)
git push -u origin HEAD

# IF REJECTED ("fetch first" error):
git pull --rebase origin <branch_name>
# (Resolve conflicts if necessary, then `git rebase --continue`)
git push origin HEAD
```

---

## 5. The "Checkpoint" Protocol (Leaving the Last Word)
To ensure background loops are idempotent (safe to run repeatedly), you must leave a comment on the PR after pushing a fix. When you scan the PR later, if the *last* comment in the timeline is yours, you know you are waiting on a human or CI, and should safely ignore the PR.

```bash
# Standard Checkpoint Reply
gh pr comment <URL> -b "I have applied the requested fixes. Awaiting further review."

# CI Attempt Checkpoint
gh pr comment <URL> -b "I have pushed an attempted fix for the CI failures."
```
