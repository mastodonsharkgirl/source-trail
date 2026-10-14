# A planned five-minute Policy Lab walkthrough

This is a presentation plan, not a timed rehearsal or usability study. It uses the actual selected recording, policy-v7-held, and preserves its failures.

| Time | Explain and demonstrate |
| --- | --- |
| 0:00–0:45 | **The problem.** An answer can use an obsolete rule, omit a conflicting policy, or rely on evidence unavailable to the requester. Introduce Cedar and Harbour as fictional organisations. |
| 0:45–1:45 | **One evidence trail.** Select held-password. Read its saved question, role and date; inspect the prepared evidence, exact passage IDs and source versions. Compare the password-reset fact with the answer and separate assessment. |
| 1:45–2:45 | **A retained failure.** Select held-travel-claim: the semantic output is rejected because a citation is not an exact supplied-source quote. Open the unedited output and support assessment. Rejection is a contract decision; it does not erase the response or establish that its prose is false. |
| 2:45–4:00 | **Three methods.** Select held-escalation and inspect competing rules and each method's supplied context. Return to the summary: supported yield is 8/14 lexical, 5/14 semantic and 6/14 full context; useful conflict abstention is 0/4 for every method. These results belong to this small corpus. |
| 4:00–5:00 | **Trade-offs and limits.** Export a case and identify the selected report hash. Explain why this viewer starts no inference, why fictional filtering is not access control, and why agent assessment and the warning-only injection source limit the claims. |

## Plain answers to likely questions

**Why retrieve at all?** Retrieval selects a smaller set of relevant passages. It can omit something essential. The semantic gate skipped five held-out calls; skips are separate from a model correctly deciding to decline.

**Why compare with all eligible passages?** Full context removes ranking as a reason for omitting eligible evidence. It can still distract the model. Its 6/14 supported yield does not establish that more context improves answers.

**Can a correct quote accompany a wrong answer?** Yes. Exact quotation is a mechanical check; whether each claim follows from the source is a separate assessment. Valid JSON can also contain the wrong abstention reason.

**Why filter before retrieval?** Inappropriate evidence must not enter ranking or context. Public examples demonstrate the rule; production enforcement would need trusted identity and server-side authorisation.

**What happens when a policy is replaced?** A current replacement retires its predecessor even when the requester cannot access the replacement. Inaccessibility does not reactivate the old rule.

**Does the injection group prove resistance?** No. Its source warns against marker disclosure rather than issuing an active hostile command. Cases mix ordinary helpdesk questions and unsafe user requests. Public marker presence establishes neither restricted-data disclosure nor compliance.

**What did the run cost?** Local inference API spend was USD0. Hardware, electricity, uninstrumented memory and development costs were not measured.

## Learning exercises — not yet observed

- Explain prepared context versus an attempted model call.
- Trace a quotation through its passage ID, version and exact saved context.
- Explain why rejected, missing and failed outputs remain in the denominator.
- Explain why copied marker text is not automatically successful injection.
- Export a case and identify its selected report fingerprint.

Mark these complete only after Saran performs them. Assisted implementation and this written script do not establish personal mastery or a rehearsed demo.
