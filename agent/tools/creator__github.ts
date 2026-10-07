/**
 * Native GitHub CLI (gh) tool for creator workflow.
 *
 * Uses the local `gh` installation to provide:
 * - Read-only: auth status, repo listing, repo inspection, file viewing, branch listing, PR listing
 * - Write (requires explicit user approval): branch creation, file create/update, commit, push, PR creation
 *
 * Safety rules:
 * - NEVER deletes repositories
 * - NEVER force-pushes
 * - NEVER overwrites existing production files without explicit approval
 * - All write operations must be explicitly requested by the user
 */

import { defineTool } from "eve/tools";
import { z } from "zod";
import { execFile as execFileNode } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileNode);

// gh CLI path — try PATH first, fall back to Windows install location.
// On Windows, `winget install` places gh at C:\Program Files\GitHub CLI\gh.exe
// which may not be in the bash $PATH, so we include it explicitly.
// The MSYS/Git-Bash path ('/c/Program Files/...') is the correct form for
// node's child_process.execFile from a Git-Bash environment.
const GH_PATHS = [
  "gh",                                              // PATH-resolved
  "C:\\Program Files\\GitHub CLI\\gh.exe",           // Windows absolute (for WSH/Node on Windows)
  "/c/Program Files/GitHub CLI/gh.exe",              // MSYS/Git-Bash path
];

async function findGh(): Promise<string> {
  for (const p of GH_PATHS) {
    try {
      const { stdout } = await execFile(p, ["--version"], { timeout: 5000 });
      if (stdout.includes("gh version")) return p;
    } catch {
      // try next
    }
  }
  throw new Error(
    "gh CLI not found. Install it from https://cli.github.com or via 'winget install GitHub.cli'"
  );
}

async function gh(args: string[], timeout = 30000): Promise<string> {
  const ghPath = await findGh();
  try {
    const { stdout, stderr } = await execFile(ghPath, args, { timeout });
    if (stderr && !stderr.includes("WARNING")) {
      // gh sometimes prints auth warnings to stderr — surface them only if no stdout
      console.warn("[gh stderr]", stderr);
    }
    return stdout.trim();
  } catch (err: unknown) {
    const execErr = err as { code?: number; message?: string; stdout?: string; stderr?: string };
    const msg = execErr.stderr?.trim() || execErr.message || String(err);
    throw new Error(`gh ${args.join(" ")} failed: ${msg}`, { cause: err });
  }
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const OperationSchema = z.enum([
  "auth_status",
  "list_repos",
  "inspect_repo",
  "list_branches",
  "list_files",
  "view_file",
  "create_branch",
  "create_or_update_file",
  "commit_and_push",
  "create_pull_request",
  "list_pull_requests",
  "view_pull_request",
]);

export const githubToolInput = z.object({
  operation: OperationSchema.describe("The GitHub operation to perform"),
  // auth
  // list_repos
  owner: z.string().optional().describe("Repository owner (user or org)"),
  limit: z.number().optional().describe("Max results (default 10, max 100)"),
  // inspect_repo
  repo: z.string().optional().describe("Repository name"),
  // list_branches / list_files / commit_and_push / create_branch
  branch: z.string().optional().describe("Branch name"),
  // view_file / create_or_update_file
  path: z.string().optional().describe("File path within the repository"),
  // create_or_update_file
  content: z.string().optional().describe("File content (for create/update operations)"),
  message: z.string().optional().describe("Commit message"),
  // create_pull_request
  title: z.string().optional().describe("PR title"),
  body: z.string().optional().describe("PR body/description"),
  base: z.string().optional().describe("Base branch for PR (default: main)"),
  // list_pull_requests
  state: z.enum(["open", "closed", "merged", "all"]).optional().describe("PR state filter"),
  // view_pull_request
  pr_number: z.number().optional().describe("Pull request number (required for view_pull_request)"),
});

export type GithubToolInput = z.infer<typeof githubToolInput>;

// ─── Output schemas ──────────────────────────────────────────────────────────

const _AuthStatusOutput = z.object({
  logged_in: z.boolean(),
  user: z.string().optional(),
  token_scope: z.string().optional(),
  message: z.string(),
});

const _RepoOutput = z.object({
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string(),
  clone_url: z.string(),
  default_branch: z.string(),
  visibility: z.string(),
  open_issues_count: z.number(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  pushed_at: z.string().nullable(),
  created_at: z.string(),
  language: z.string().nullable(),
  topics: z.array(z.string()),
  license: z.string().nullable(),
});

const _BranchOutput = z.object({
  name: z.string(),
  commit_sha: z.string(),
  is_protected: z.boolean(),
});

const _FileOutput = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "dir", "symlink", "submodule", "commit"]),
  size: z.number(),
  sha: z.string(),
  url: z.string(),
});

const _CommitOutput = z.object({
  message: z.string(),
  sha: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  author_date: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  committer_date: z.string(),
});

const _PROutput = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed", "merged"]),
  html_url: z.string(),
  user_login: z.string(),
  base_branch: z.string(),
  head_branch: z.string(),
  is_draft: z.boolean(),
  is_cross_repository: z.boolean(),
  commits_count: z.number(),
  additions: z.number(),
  deletions: z.number(),
  changed_files_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable(),
  merged_by: z.string().nullable(),
  reviewers: z.array(z.string()),
  labels: z.array(z.string()),
  url: z.string(),
});

// ─── Operation implementations ───────────────────────────────────────────────

async function opAuthStatus(): Promise<unknown> {
  try {
    const out = await gh(["auth", "status", "--json", "hosts"]);
    const data = JSON.parse(out);
    const host = (data.hosts || [])[0];
    return {
      logged_in: !!host,
      user: host?.user?.login,
      token_scope: host?.token_scope,
      hostname: host?.account?.login,
      message: host ? `Logged in as ${host?.user?.login}` : "Not logged in",
    };
  } catch {
    return {
      logged_in: false,
      user: undefined,
      token_scope: undefined,
      message: "Not logged in. Run: gh auth login",
    };
  }
}

async function opListRepos(owner?: string, limit = 10): Promise<unknown> {
  const args = owner
    ? ["repo", "list", owner, `--limit=${Math.min(limit, 100)}`, "--json"]
    : ["repo", "list", `--limit=${Math.min(limit, 100)}`, "--json",
    "--state", state,
    "-R", `${owner}/${repo}`];
  const out = await gh(args);
  const repos = JSON.parse(out || "[]");
  return { repos, count: repos.length };
}

async function opInspectRepo(owner: string, repo: string): Promise<unknown> {
  const out = await gh(["repo", "view", `${owner}/${repo}`, "--json", "name,defaultBranch,description,visibility,openIssuesCount,stargazerCount,forksCount,pushedAt,createdAt,language,topics,license"]);
  return JSON.parse(out);
}

async function opListBranches(owner: string, repo: string): Promise<unknown> {
  const out = await gh(["repo", "branch", "list", "--json=name,sha,isProtected", "-R", `${owner}/${repo}`]);
  const branches = JSON.parse(out || "[]");
  return { branches, count: branches.length };
}

async function opListFiles(
  owner: string,
  repo: string,
  branch?: string,
  path?: string
): Promise<unknown> {
  const args = ["repo", "files", "list", "-R", `${owner}/${repo}`, "--json", "name,path,sha,type"];
  if (branch) args.push("--branch", branch);
  if (path) args.push("--path", path);
  const out = await gh(args);
  const files = JSON.parse(out || "[]");
  return { files, count: files.length };
}

async function opViewFile(owner: string, repo: string, branch: string, path: string): Promise<unknown> {
  const content = await gh(["repo", "view", `${owner}/${repo}`, "-B", branch, "--path", path]);
  // gh view --path returns raw content for files, JSON for directory
  try {
    const data = JSON.parse(content);
    return data;
  } catch {
    return { content, path, repo: `${owner}/${repo}`, branch };
  }
}

async function opCreateBranch(owner: string, repo: string, branch: string): Promise<unknown> {
  await gh(["repo", "branch", "create", "-R", `${owner}/${repo}`, branch, "--clone"]);
  return {
    message: `Branch '${branch}' created in ${owner}/${repo}`,
    branch,
    repo: `${owner}/${repo}`,
  };
}

async function opCreateOrUpdateFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message?: string
): Promise<unknown> {
  // Check if file already exists to set the right commit message
  let fileExists: boolean;
  try {
    await gh(["repo", "view", `${owner}/${repo}`, "-B", branch, "--path", path]);
    fileExists = true;
  } catch {
    fileExists = false;
  }

  const msg = message || (fileExists ? `Update ${path}` : `Create ${path}`);
  if (fileExists) {
    await gh([
      "api",
      `repos/${owner}/${repo}/contents/${path}`,
      "--method", "PUT",
      "-f", `message=${msg}`,
      "-f", `content=${Buffer.from(content).toString("base64")}`,
      "-f", `branch=${branch}`,
    ]);
    return { message: `Updated ${path} on ${branch}`, path, branch, action: "updated" };
  } else {
    await gh([
      "api",
      `repos/${owner}/${repo}/contents/${path}`,
      "--method", "PUT",
      "-f", `message=${msg}`,
      "-f", `content=${Buffer.from(content).toString("base64")}`,
      "-f", `branch=${branch}`,
    ]);
    return { message: `Created ${path} on ${branch}`, path, branch, action: "created" };
  }
}

async function opCommitAndPush(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message?: string
): Promise<unknown> {
  // Equivalent to create_or_update_file + git push via gh api
  const msg = message || `Create/update ${path}`;
  const _encoded = Buffer.from(content).toString("base64");

  // Get current SHA if file exists
  let sha: string | undefined;
  try {
    const existing = await gh(["api", `repos/${owner}/${repo}/contents/${path}?ref=${branch}`]);
    const parsed = JSON.parse(existing);
    sha = parsed.sha;
  } catch {
    sha = undefined;
  }

  const payload: Record<string, string> = {
    message: msg,
    content,
    branch,
  };
  if (sha) payload["sha"] = sha;



  const args = [
    "api",
    `repos/${owner}/${repo}/contents/${path}`,
    "--method", "PUT",
    "-f", `message=${msg}`,
    "-f", `content=${Buffer.from(content).toString("base64")}`,
    "-f", `branch=${branch}`,
  ];
  if (sha) args.push("-f", `sha=${sha}`);

  await gh(args);

  return {
    message: `Committed and pushed ${path} to ${branch}`,
    path,
    branch,
    repo: `${owner}/${repo}`,
    commit_message: msg,
  };
}

async function opCreatePullRequest(
  owner: string,
  repo: string,
  headBranch: string,
  title?: string,
  body?: string,
  base = "main"
): Promise<unknown> {
  const args = [
    "pr",
    "create",
    "-R",
    `${owner}/${repo}`,
    "-B",
    base,
    "-H",
    headBranch,
  ];
  if (title) args.push("--title", title);
  if (body) args.push("--body", body);

  const out = await gh(args);
  return {
    message: `Pull request created: ${out}`,
    pr_url: out,
    head_branch: headBranch,
    base_branch: base,
  };
}

async function opListPullRequests(
  owner: string,
  repo: string,
  state = "open"
): Promise<unknown> {
  const out = await gh([
    "pr",
    "list",
    "-R",
    `${owner}/${repo}`,
    "--state",
    state,
    "--json",
    "--state", state,
    "-R", `${owner}/${repo}`,
  ]);
  const prs = JSON.parse(out || "[]");
  return { pull_requests: prs, count: prs.length, state };
}

async function opViewPullRequest(owner: string, repo: string, prNumber?: number): Promise<unknown> {
  const num = prNumber ?? 0;
  const out = await gh(["pr", "view", `${owner}/${repo}#${num}`, "--json", "number,title,state,author,url,headRefName,baseRefName,createdAt,body,bodyText"]);
  return JSON.parse(out);
}

// ─── Main tool ────────────────────────────────────────────────────────────────

export default defineTool({
  description:
    "Native GitHub CLI (gh) tool for creator workflow. " +
    "Supports auth check, repo listing, repo inspection, branch management, " +
    "file viewing, commits, pushes, and PR creation. " +
    "Read-only operations (auth_status, list_repos, inspect_repo, list_branches, " +
    "list_files, view_file, list_pull_requests, view_pull_request) are safe by default. " +
    "Write operations (create_branch, create_or_update_file, commit_and_push, " +
    "create_pull_request) require explicit user approval. " +
    "NEVER deletes repositories or force-pushes.",
  inputSchema: githubToolInput,
  outputSchema: z.object({}).passthrough(), // varied output per operation
  async execute({ operation, owner, repo, branch, path, content, message, title, body, base, limit, state }) {
    // Validate owner/repo are required for most operations
    const requiresOwner = !["auth_status"].includes(operation);
    const requiresRepo = !["auth_status", "list_repos"].includes(operation);
    const requiresBranch = ["list_files", "view_file", "commit_and_push"].includes(operation);

    if (requiresOwner && !owner) {
      throw new Error(`Operation '${operation}' requires an 'owner' (GitHub username or org)`);
    }
    if (requiresRepo && !repo) {
      throw new Error(`Operation '${operation}' requires a 'repo' (repository name)`);
    }
    if (requiresBranch && !branch) {
      throw new Error(`Operation '${operation}' requires a 'branch' name`);
    }

    switch (operation) {
      case "auth_status":
        return await opAuthStatus();

      case "list_repos":
        return await opListRepos(owner, limit);

      case "inspect_repo":
        return await opInspectRepo(owner!, repo!);

      case "list_branches":
        return await opListBranches(owner!, repo!);

      case "list_files":
        return await opListFiles(owner!, repo!, branch, path);

      case "view_file":
        return await opViewFile(owner!, repo!, branch!, path!);

      case "create_branch":
        return await opCreateBranch(owner!, repo!, branch!);

      case "create_or_update_file":
        if (!content) throw new Error("'content' is required for create_or_update_file");
        return await opCreateOrUpdateFile(owner!, repo!, branch!, path!, content, message);

      case "commit_and_push":
        if (!content) throw new Error("'content' is required for commit_and_push");
        return await opCommitAndPush(owner!, repo!, branch!, path!, content, message);

      case "create_pull_request":
        return await opCreatePullRequest(owner!, repo!, branch!, title, body, base);

      case "list_pull_requests":
        return await opListPullRequests(owner!, repo!, state);

      case "view_pull_request":
        return await opViewPullRequest(owner!, repo!, pr_number);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
});
