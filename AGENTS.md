<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Expense edits (fields + replacement splits) go through the update_expense_with_splits RPC (SECURITY INVOKER) — one transaction, so a failure never leaves an expense without splits. Membership writes must request affected row ids and treat zero rows as failure — RLS-blocked writes return no error.
