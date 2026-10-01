# Repository settings

Apply these settings in GitHub after the workflows have run once.

## Branch protection for `main`

- Require a pull request with at least one approval.
- Dismiss stale approvals when new commits are pushed.
- Require review from Code Owners when a `CODEOWNERS` file is added.
- Require conversation resolution before merging.
- Require branches to be up to date before merging.
- Require these status checks:
  - `Frontend`
  - `Backend`
  - `End-to-end`
  - `Container builds`
  - `Analyze (javascript-typescript)`
  - `Analyze (python)`
- Block force pushes and branch deletion.
- Include administrators unless an emergency bypass policy is documented.

## Security and maintenance

- Enable private vulnerability reporting, Dependabot alerts, and Dependabot security updates.
- Enable secret scanning and push protection where the repository plan supports them.
- Enable automatic deletion of head branches after pull requests merge.
- Allow squash merging and define a consistent commit-message format.
- Limit GitHub Actions to actions used by this repository and require approval for first-time external contributors.

Do not add a `CODEOWNERS` file until the owning GitHub users or teams are confirmed; an invalid owner can block protected-branch merges.
