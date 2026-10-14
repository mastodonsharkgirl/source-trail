# A planned five-minute Policy Lab walkthrough

This is a presentation plan, not a timed rehearsal or usability study. Today the
page has an explicit pending state. Demonstrate that state honestly until actual
recorded evidence and browser verification are complete.

| Time | Explain and demonstrate |
| --- | --- |
| 0:00–0:45 | **The problem.** “An answer can sound reasonable while using an outdated policy, missing one of two conflicting rules, or relying on evidence unavailable to the requester.” Introduce Cedar and Harbour as fictional organisations. |
| 0:45–1:45 | **One evidence trail.** After evaluation, choose one saved case. Read its fixed question, principal and date. Open the prepared passages and show the exact source version and quotation. Currently show the unavailable state and explain that no case has been recorded. |
| 1:45–2:45 | **One failure or abstention.** Use an actual retained failure, if present, and separate the raw model output from parser rejection, retrieval abstention and support assessment. Never invent a bad or good output for this demonstration. |
| 2:45–4:00 | **Three methods.** Compare lexical, semantic and full-context rows for the same question. Discuss relevant evidence retained or omitted, supported yield and abstention with raw denominators. Until measured, describe this as the comparison design only. |
| 4:00–5:00 | **Trade-offs and limits.** Export the case after a real run exists and identify its snapshot hash. Explain the small fictional corpus, unmeasured hardware costs and unbuilt production access controls. |

## Plain answers to likely questions

**Why retrieve at all?** Retrieval can select a smaller set of relevant passages
for an answer. It may also omit something essential, which this comparison needs
to expose rather than hide.

**Why compare with every eligible document?** Full context provides a useful
reference: it removes ranking as a reason for missing an eligible passage. It can
still include distracting or conflicting material and does not guarantee a good
answer.

**Can a correct quote accompany a wrong answer?** Yes. A model can copy a sentence
exactly and draw an unsupported conclusion from it. Quotation validity and source
support are separate checks.

**Why filter before retrieval?** If a document is inappropriate for the saved
principal or date, it must not enter ranking or generation context. These public
examples illustrate the rule; real access control would need server enforcement.

**What happens when a policy is replaced?** The current replacement retires its
predecessor even when the requester cannot access the replacement. The old rule
does not become valid again just because it is easier to find.

**Why does this not prove enterprise reliability?** The data is authored, small
and overlapping. There are no confirmed customers, production workloads, deployed
identity controls, broad device benchmarks or independent validation here.

## Learning exercises — not yet observed

- Explain the difference between a prepared context and a model-call attempt.
- Trace a source quotation through its passage ID, version and exact context.
- Explain why an invalid output stays in the denominator.
- Explain why a copied attack marker is not automatically successful injection.
- Reproduce a case export and identify the selected report fingerprint.

Mark these complete only after Saran actually performs them. AI-assisted source
implementation and this written script are not evidence of personal mastery.
