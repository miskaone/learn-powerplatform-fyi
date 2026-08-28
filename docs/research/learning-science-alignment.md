# Learning-Science Alignment Brief — Mastery Gate

**Purpose.** Map the evidence base from cognitive/educational psychology and recent AI-tutoring research onto Mastery Gate's actual mechanisms (redacted Socratic agent coaching, misconception-keyed grading, four-dimension rubric gating, predict–commit–reveal drills, module sequencing, exam debrief), and name evidence-backed techniques the product does not yet use.

**Scope note.** Mastery Gate (per `ISA.md`) is a static-export PL-400 course whose deterministic TypeScript engine governs a visiting WebMCP agent: answer keys are structurally redacted from tool schemas; grading keys remediation to a named 17-misconception taxonomy; a Recall/Connections/Application/Transfer rubric (0–4 each) gates module advancement at every-dimension ≥3; drills enforce commit-before-reveal; Exam Mode revokes the coaching toolset; a debrief plays from the session ledger. There is deliberately **no spaced-review calendar** (out of scope per ISA) and no free-text NLP scoring.

---

## 1. Ranked summary table

Ranked by evidence strength (robustness of replication, breadth of meta-analytic support, ecological validity), then by relevance to this product.

| # | Technique | Evidence strength | One-line takeaway |
|---|---|---|---|
| 1 | Retrieval practice / testing effect | **Very strong** (hundreds of experiments; [Roediger & Karpicke 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x); [Dunlosky et al. 2013](https://journals.sagepub.com/doi/10.1177/1529100612453266)) | Testing is not measurement — the test itself is the learning event; beats restudy for retention. |
| 2 | Feedback quality (specific, cue-directed) | **Very strong** meta-analytically ([Hattie & Timperley 2007](https://doi.org/10.3102/003465430298487); [VanLehn 2011](https://doi.org/10.1080/00461520.2011.611369)) | Feedback that names *why* an answer failed at the misconception level beats right/wrong or praise. |
| 3 | Mastery learning + ITS | **Strong** ([Bloom 1984](https://doi.org/10.3102/0013189X013006004); [Kulik & Fletcher 2016](https://doi.org/10.3102/0034654315581420), median ES ≈ 0.66; [VanLehn 2011](https://doi.org/10.1080/00461520.2011.611369)) | Gate advancement on demonstrated mastery per objective and step-level tutoring approaches human-tutor effect sizes. |
| 4 | Worked examples → faded practice; expertise reversal | **Strong** ([Atkinson et al. 2000](https://doi.org/10.1023/A:1019126019043); [Kalyuga et al. 2003](https://doi.org/10.1080/00461520.2003.10756917); [Renkl 2014](https://doi.org/10.1016/j.edurev.2014.03.002)) | Novices learn from worked examples; the same examples *hurt* experts — instruction must adapt to expertise. |
| 5 | Spacing / distributed practice | **Very strong** ([Cepeda et al. 2006](https://doi.org/10.1037/0033-2909.132.3.354); Dunlosky 2013) | Spaced retrieval beats massed; benefit grows with retention interval — and Mastery Gate currently has none across sessions. |
| 6 | Interleaving | **Strong**, domain-dependent ([Rohrer & Taylor 2007](https://doi.org/10.1007/s11251-007-9015-8); [Rohrer et al. 2015](https://doi.org/10.1037/xap0000056), math d ≈ 0.8+) | Mixing problem *categories* forces discrimination — exactly the skill mislead-by-distractor exams test. |
| 7 | Self-explanation | **Moderate–strong** ([Chi et al. 1994](https://doi.org/10.1207/s15516709cog1803_3); [Bisra et al. 2018](https://doi.org/10.1023/B:EDPR.0000012344.39575.6c) ≈ 0.55) | Prompting learners to explain *why* improves integration; best when scaffolded, not free-form. |
| 8 | Desirable difficulties (framing theory) | **Strong as theory** ([Bjork 1994](https://doi.org/10.7551/mitpress/4742.003.0020); [Bjork & Bjork 2011](https://doi.org/10.1017/CBO9781139013439.022)) | Conditions that slow acquisition (spacing, interleaving, generation) improve retention — the design rationale for gates and drills. |
| 9 | Elaborative interrogation | **Moderate** (Dunlosky 2013) | "Why is this true?" prompts help factual integration; weaker for complex material. |
| 10 | Transfer-appropriate retrieval | **Moderate, nuanced** ([Pan & Rickard 2018](https://doi.org/10.1037/bul0000151)) | Retrieval gains transfer substantially but not fully; transfer needs practice at the target level of application. |
| 11 | LLM/AI tutoring | **Emerging: strong short-run RCTs, thin durability evidence** ([Kestin et al. 2025](https://doi.org/10.1038/s41598-025-97652-7); [De Simone et al. 2025, World Bank](https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099548105192529324)) | Purpose-built AI tutors roughly double learning efficiency vs active learning in RCTs — but guardrails matter and long-run evidence is absent. |

---

## 2. Per-technique evidence and alignment

### 2.1 Retrieval practice / the testing effect

**Evidence.** Roediger & Karpicke (2006) showed that repeated **testing** of prose material produced better long-term retention (1 week) than repeated **studying**, despite study groups feeling more competent short-term ([Roediger & Karpicke 2006, *Psychological Science*](https://doi.org/10.1111/j.1467-9280.2006.01693.x)). Dunlosky et al.'s monograph rated practice testing one of only two **high-utility** techniques, robust across ages, materials, and outcomes ([Dunlosky et al. 2013, *PSPI*](https://journals.sagepub.com/doi/10.1177/1529100612453266); [practitioner summary](https://www.aft.org/ae/fall2013/dunlosky)). Feedback during retrieval amplifies the effect; the benefit is largest on delayed tests.

**Alignment with Mastery Gate.** The core loop *is* retrieval practice with delayed, gated feedback: `get_current_question` forces the learner to generate an answer from a redacted schema (the agent cannot hand over the key — structural redaction means retrieval is unavoidable); the "retrieval lab" in each micro-lesson and the lesson-scoped retake (`resetQuestions`) make retesting a first-class action rather than a punishment. The hint ladder's refusal of tier-2 hints before a genuine first attempt (ISC-17) is a direct implementation of "make the learner retrieve before scaffold" — a desirable-difficulty guard. The resolution-released rationale (feedback only after the attempt) matches the evidence that feedback after an retrieval attempt is more effective than feedback that pre-empts it.

### 2.2 Feedback: specific, at the level of the error

**Evidence.** Hattie & Timperley's synthesis (average effect of feedback interventions among the largest in education) argues effective feedback answers three questions — *Where am I going? How am I going? Where to next?* — and that **task- and process-level** feedback outperforms self-level (praise) feedback ([Hattie & Timperley 2007, *RER*](https://doi.org/10.3102/003465430298487)). VanLehn's review found **step-based** tutoring (feedback on each reasoning step) approached human tutoring's effectiveness, exceeding answer-based feedback ([VanLehn 2011, *Educational Psychologist*](https://doi.org/10.1080/00461520.2011.611369)).

**Alignment with Mastery Gate.** Misconception-keyed grading is this finding, operationalized: a miss returns the **named misconception id** and a contrast (`whyTempting`/`whyWrong` distractor anatomy), not a bare wrong flag — task-level feedback naming the faulty mental model, plus a remediation anchor that routes to the exact same-lesson section. The routing table (first miss → hint, second → review, repeated misconception → dedicated coach tool `get_misconception_brief` firing only on the second occurrence) matches the evidence that feedback should escalate in specificity as errors persist. The four-dimension rubric with **verbatim evidence quotes** (`score_rubric` rejects submissions lacking them) forces the feedback to be grounded in observed learner behavior rather than global impressions — a structural defense against "feedback by vibes."

### 2.3 Mastery learning and intelligent tutoring systems

**Evidence.** Bloom (1984) reported students under one-on-one mastery-condition tutoring performing ~2 standard deviations above conventional class instruction, framing tutoring + mastery as the benchmark ([Bloom 1984, *Educational Researcher*](https://doi.org/10.3102/0013189X013006004)). Kulik & Fletcher's meta-analysis of 50+ controlled evaluations found intelligent tutoring systems produced a median effect of ~0.66 SD vs conventional instruction ([Kulik & Fletcher 2016, *RER*](https://doi.org/10.3102/0034654315581420)); VanLehn (2011) found step-based ITS (~0.76) statistically indistinguishable from human tutoring (~0.79) — the realized portion of Bloom's 2 sigma. Mastery learning itself (Kulik's earlier meta-analyses, summarized in Kulik & Fletcher 2016) contributes roughly half an SD on its own.

**Alignment with Mastery Gate.** The product is an ITS by construction, with the LLM as explanation layer and the deterministic engine as the tutor model: advancement is gated per-dimension at ≥3/4 (no averaged mastery — "an average is where weaknesses hide," which matches mastery learning's insistence on per-objective convergence), routing is condition→action, and the Tool Roster's dynamic `advance_module` registration makes mastery observable. Notably, the 2026-08-27 cross-review fixed a real ITS-integrity failure (the agent self-awarding 4/4/4/4 by quoting the question prompt as evidence) — the literature's warning that *the tutor*, not just the tutee, must be held to the standard.

### 2.4 Worked examples and the expertise reversal effect

**Evidence.** Worked-example studies (Atkinson, Derry, Renkl & Wortham 2000; Renkl 2014) show novices learn more from studying worked solutions than unguided problem solving, via cognitive-load reduction — but Kalyuga et al. demonstrate the **expertise reversal effect**: the same detailed guidance becomes redundant and harmful as learners gain expertise, so instruction must fade ([Atkinson et al. 2000](https://doi.org/10.1023/A:1019126019043); [Kalyuga et al. 2003](https://doi.org/10.1080/00461520.2003.10756917); [Renkl 2014, *Educational Psychology Review*](https://doi.org/10.1016/j.edurev.2014.03.002)).

**Alignment with Mastery Gate.** The micro-lesson arc is a faded-example sequence: scenario commit-before-reveal → concept hierarchy → interactive visual walkthrough → distractor teardown → retrieval lab → drills — i.e., worked orientation first, then unsupported retrieval. The routing row *correct + low-confidence → go_deeper* is a within-session version of expertise adaptation (competence without confidence gets more instruction rather than more of the same). The gate itself is a coarse expertise signal that unlocks new material rather than re-serving examples.

### 2.5 Spacing / distributed practice

**Evidence.** Cepeda et al.'s meta-analysis of 254 studies (14,000+ participants) found spaced presentations beat massed by ~15% on average, with optimal gap scaling with retention interval (~10–20% of the test delay) ([Cepeda et al. 2006, *Psychological Bulletin*](https://doi.org/10.1037/0033-2909.132.3.354)); Dunlosky et al. (2013) rate distributed practice high-utility.

**Alignment with Mastery Gate.** *Partial and deliberately limited.* Spacing exists **between** modules (five lessons across separate routes, session state in localStorage so re-engagement resumes rather than restarts), but the ISA explicitly rules out spaced-review calendars for the contest build, and nothing schedules re-retrieval of previously mastered material across sessions. Within a session, the "repeated misconception → coach" path induces re-engagement with earlier material, which is a weak form of spacing. See Gaps.

### 2.6 Interleaving

**Evidence.** Rohrer & Taylor (2007) showed shuffling mathematics practice problems (so learners must *choose* the strategy, not just execute it) improved one-week test performance dramatically over blocked practice ([Rohrer et al. 2007, *Instructional Science*](https://doi.org/10.1007/s11251-007-9015-8)); Rohrer, Dedrick & Stershic (2015) replicated in classrooms with large effects (test d ≈ 0.83 vs ~0 massed; [JEP:Applied](https://doi.org/10.1037/xap0000056)). Dunlosky et al. rate interleaving moderate-utility (fewer classroom studies). Interleaving's mechanism — discriminative contrast between confusable categories — is precisely what misconception-keyed distractors train.

**Alignment with Mastery Gate.** The **full-track practice loop** on the hub mixes questions across all five lessons, which is genuine category interleaving against a shared misconception taxonomy (three misconceptions deliberately span lessons). But lesson pages scope questions to the current lesson (`setQuestionScope`), and question types are homogeneous (multiple choice). Interleaving is present as an option, not as the default or scheduled condition. See Gaps.

### 2.7 Self-explanation

**Evidence.** Chi et al. (1994) showed prompting learners to self-explain worked steps improved understanding of a mechanistic system ([Chi et al. 1994, *Cognitive Science*](https://doi.org/10.1207/s15516709cog1803_3)); Bisra et al.'s meta-analysis (64 comparisons, g ≈ 0.55) confirms self-explanation prompts help across domains, with prompted/scaffolded formats outperforming spontaneous explanation ([Bisra et al. 2018](https://doi.org/10.1023/B:EDPR.0000012344.39575.6c)). Dunlosky et al. rate it moderate-utility.

**Alignment with Mastery Gate.** The Socratic redacted-agent design *is* an elicitation machine: because the agent cannot reveal answers, its only available moves are questions that make the learner articulate reasoning — self-explanation by architecture rather than by prompt template. The rubric's Connections and Transfer dimensions reward articulated reasoning (with verbatim quotes as evidence). Lesson pages include a "drills + reflection" section, and `log_coaching_note` gives the agent a place to record elicited explanations. Free-text learner explanations are deliberately not scored (out of scope, sensibly given NLP-grading reliability).

### 2.8 Desirable difficulties

**Evidence.** Bjork's framework holds that conditions slowing acquisition — spacing, interleaving, generation, reduced feedback frequency — improve long-term retention and transfer while *feeling* worse ([Bjork 1994](https://doi.org/10.7551/mitpress/4742.003.0020); [Bjork & Bjork 2011](https://doi.org/10.1017/CBO9781139013439.022)). A core corollary: learners' subjective fluency mispredicts learning, so conditions of instruction should be engineered, not chosen by the learner.

**Alignment with Mastery Gate.** The product's founding thesis. The site refuses to make things easy on the agent's behalf ("just tell me the answer" is structurally impossible); the gate makes advancement difficult; predict–commit–reveal makes belief commitment difficult to walk back; the hint ladder makes premature scaffolding difficult to reach. This is the rare ed-tech product whose entire interaction contract is a desirable-difficulty contract, with the deterministic engine (not learner preference or model compliance) as the guarantor.

### 2.9 Transfer-appropriate processing / transfer of retrieval practice

**Evidence.** Pan & Rickard's meta-analysis found testing improves transfer outcomes (g ≈ 0.40 overall across inference/application categories), but transfer is incomplete and strongest when retrieval practice matches the target skill's difficulty and format ([Pan & Rickard 2018, *Psychological Bulletin*](https://doi.org/10.1037/bul0000151)).

**Alignment with Mastery Gate.** The **Flip-Condition drill** (mutate an assumption → commit prediction → reveal outcome) is transfer practice, not recall practice: it forces application of the same rule under changed premises, which is exactly the "practice at the target level" Pan & Rickard recommend. Rubric dimension *Transfer ≥3* being gate-critical institutionalizes this. Exam Mode's removed coaching tools also make the exam a transfer-appropriate analogue of the certification test condition (unguided retrieval under time pressure).

### 2.10 Elaborative interrogation

**Evidence.** "Why is this true?" prompts improve factual integration with moderate effect, best for learners with prior knowledge and for facts with causal structure; Dunlosky et al. rate moderate-utility ([Dunlosky et al. 2013](https://journals.sagepub.com/doi/10.1177/1529100612453266)).

**Alignment with Mastery Gate.** Every distractor carries `whyTempting`/`whyWrong` anatomy, turning wrong answers into interrogation material ("why did this option seem right?") rather than noise. The scenario commit-before-reveal opening of each lesson is an elaborative frame. This is ambient rather than prompted — the agent can interrogate elaboratively, but the engine does not require it.

### 2.11 LLM / AI tutoring evidence (2020–2026)

**Evidence.** Two headline RCTs:

- **Kestin, Miller et al. (Harvard), 2025** — a custom GPT-4 tutor with pedagogical guardrails (hints over answers, Socratic prompts) vs experienced instructors using active learning in a Harvard physics course: students learned **more than twice as much in less than half the time** (d ≈ 2.1 on the posttest) in a within-subject randomized design ([Kestin et al. 2025, *Scientific Reports*](https://doi.org/10.1038/s41598-025-97652-7); [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/); [Harvard Gazette](https://news.harvard.edu/gazette/story/2024/09/professor-tailored-ai-tutor-to-physics-course-engagement-doubled/)). Independent critiques note possible novelty and time-on-task confounds ([ETC Journal review](https://etcjournal.com/2025/11/10/review-of-kestin-et-al-s-june-2025-harvard-study-on-ai-tutoring/)).
- **De Simone et al., World Bank, Edo State Nigeria, 2024/2025** — six-week after-school GPT-4 tutoring RCT; ~0.3 SD gains on pen-and-paper transfer tests (larger than ~80% of benchmark interventions), with gains concentrated where the program was well-implemented; durability and exam-aid dependence raised as caveats ([World Bank blog](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria); [working paper #11125](https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099548105192529324)).

Adjacent concern: unguarded ChatGPT *practice-exam* use can impair performance when the aid is removed (Bastani et al. 2024, Turkish high-school math RCT) — evidence that access alone is not tutoring, and guardrails are the active ingredient.

**Alignment with Mastery Gate.** Mastery Gate's entire contribution sits exactly on the active ingredient these studies imply: Kestin's tutor worked *because* it was constrained to coach rather than tell — Mastery Gate makes those constraints **architectural** (structural redaction, deterministic grading, tool-based capability) rather than prompt-level, so they cannot be socially engineered away. The Bastani-style failure mode (crutch → collapse when the aid is removed) is directly countered by Exam Mode's revocation of the coaching toolset: the product trains in the aided condition and tests in the unaided one, then debriefs from the ledger.

---

## 3. Gaps — evidence-backed techniques not yet used

1. **Spaced-retrieval scheduling across sessions.** The single largest evidence-backed gap (Cepeda et al. 2006; Dunlosky 2013 rate it high-utility). The ISA excludes spaced-review calendars for contest scope; post-contest, the engine's localStorage ledger already records per-question resolution timestamps, so a minimal expanding-interval queue (re-present resolved questions at 1d/3d/7d, dropping those answered correctly twice consecutively) is a pure engine feature needing no backend. Concrete shape: a `due_review` section on the hub driven by the existing ledger.

2. **Systematic interleaving schedule.** Full-track practice exists but is opt-in; lessons default to blocked practice. Rohrer et al. (2015) suggest interleaving should be the default once categories are introduced. Concrete suggestion: after first pass through two lessons, blend their questions automatically (the shared-misconception taxonomy already supports cross-lesson discrimination), and inform the learner — explicit "mixed practice" labeling improves acceptance and metacognitive calibration.

3. **Self-explanation prompts in the agent-less path.** The Socratic agent elicits explanations, but agent-less learners get no prompt to articulate *why* an answer is right before the rationale releases. Concrete suggestion: a lightweight optional "explain your choice in one sentence" step before reveal in the retrieval lab (ungraded, stored in the ledger, shown in the debrief) — Bisra et al. (2018) show prompted formats outperform spontaneous ones.

4. **Prequestions / pretests.** Prequestions before a lesson improve later learning of the prequestioned material (e.g., Carpenter & Toftness 2017; Richland et al. on pretesting). The scenario commit already approximates this; a deliberate set of 2–3 prequestions per lesson (answered before instruction, errors explicitly forgiven) would extend the effect to more of the material.

5. **Success-feedback specificity.** Hattie & Timperley note feedback after *correct* answers matters too — confirming *why* the chosen option was right (not just that it was) reduces misconception formation on lucky guesses. The rationale currently releases on resolution regardless; an explicit "justify the correct answer and name which distractor myth it defeats" success card would close this. The confidence plumbing (`correct + low-confidence → go_deeper`) is the right hook already in place.

6. **Generation on hints (fade the options).** A stronger generation difficulty than MC recognition: on a second miss, re-ask the question with options hidden (short constructed recall against the same key) before routing to review — this converts a recognition miss into retrieval practice, per the testing-effect literature on recall > recognition for retention.

7. **Durability measurement.** No delayed posttest exists anywhere (exam is immediate). Even a self-reported "one week later, hub shows a 5-question delayed quiz on resolved material" would let the product demonstrate retention, which is the outcome the entire evidence base is measured on.

---

## 4. Caveats — thin evidence and small effects

- **Elaborative interrogation and self-explanation are moderate-utility**, with effects shrinking for complex material and for low-knowledge learners (Dunlosky et al. 2013). Their presence in Mastery Gate as *architecture-mediated* (Socratic constraint) rather than direct prompts is a reasonable bet but is itself untested — no study we located tests redacted-tool Socratic LLM agents specifically.
- **Interleaving evidence is domain-skewed** (strong in math/category discrimination; weaker in vocabulary-like recall), and classroom replications are fewer than lab studies (Dunlosky et al. 2013; Rohrer et al. 2015 is the strongest classroom result).
- **AI-tutoring RCTs are short and confoundable.** Kestin et al.'s d ≈ 2 is from a single institution, single topic, within-subject design with plausible novelty/Hawthorne contributions ([ETC Journal critique](https://etcjournal.com/2025/11/10/review-of-kestin-et-al-s-june-2025-harvard-study-on-ai-tutoring/)); the Nigeria study's "two years of learning" framing is contested and the 0.3 SD headline attenuates across implementations. Neither establishes months-scale retention or transfer to certification-exam performance — the exact claim an exam-prep product implicitly makes.
- **Bloom's 2 sigma is a benchmark, not an effect** — the original study was uncontrolled by modern standards, and VanLehn (2011) argues the realized human-tutor effect (~0.79) is closer to ITS range than to 2.0. Marketing-adjacent claims about the product should avoid leaning on 2-sigma.
- **Mastery learning's cost is time.** Kulik's mastery meta-analyses show larger effects when time-on-task is held constant shrinks the advantage; the gate necessarily slows fast learners (the go_deeper / confidence routing partially mitigates).
- **The testing effect's transfer is incomplete** (Pan & Rickard 2018: transfer g ≈ 0.40 < retention gains); the Flip-Condition drill is a theory-motivated response, not a guarantee that PL-400 exam performance improves.
- **Desirable difficulties backfire for novices** — difficulties are only "desirable" once the learner has partial competence (Bjork & Bjork 2011); the hint ladder and remediation routing are the correct mitigations, but the very first exposure to a hard objective could overwhelm a true novice, and the engine currently has no novice on-ramp weaker than the hint tier-1.

---

### Reference list (primary sources)

- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). [Improving Students' Learning With Effective Learning Techniques](https://journals.sagepub.com/doi/10.1177/1529100612453266). *Psychological Science in the Public Interest*, 14(1), 4–58.
- Roediger, H. L., & Karpicke, J. D. (2006). [Test-enhanced learning](https://doi.org/10.1111/j.1467-9280.2006.01693.x). *Psychological Science*, 17(3), 249–255.
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). [Distributed practice in verbal recall tasks](https://doi.org/10.1037/0033-2909.132.3.354). *Psychological Bulletin*, 132(3), 354–380.
- Rohrer, D., & Taylor, K. (2007). [The shuffling of mathematics problems improves learning](https://doi.org/10.1007/s11251-007-9015-8). *Instructional Science*, 35, 481–498.
- Rohrer, D., Dedrick, R. F., & Stershic, S. (2015). [Interleaved practice improves mathematics learning](https://doi.org/10.1037/xap0000056). *Journal of Educational Psychology: Applied*, 21(4), 363–373.
- Bjork, R. A. (1994). [Memory and metamemory considerations in the training of human beings](https://doi.org/10.7551/mitpress/4742.003.0020). In *Metacognition: Knowing about knowing*. MIT Press.
- Bjork, R. A., & Bjork, E. L. (2011). [Making things hard on yourself, but in a good way](https://doi.org/10.1017/CBO9781139013439.022). In *Successful remembering and successful forgetting*. Psychology Press.
- Bloom, B. S. (1984). [The 2 sigma problem](https://doi.org/10.3102/0013189X013006004). *Educational Researcher*, 13(6), 4–16.
- Kulik, J. A., & Fletcher, J. D. (2016). [Effectiveness of intelligent tutoring systems: a meta-analytic review](https://doi.org/10.3102/0034654315581420). *Review of Educational Research*, 86(1), 42–78.
- VanLehn, K. (2011). [The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems](https://doi.org/10.1080/00461520.2011.611369). *Educational Psychologist*, 46(4), 197–221.
- Hattie, J., & Timperley, H. (2007). [The power of feedback](https://doi.org/10.3102/003465430298487). *Review of Educational Research*, 77(1), 81–112.
- Chi, M. T. H., de Leeuw, N., Chiu, M.-H., & LaVancher, C. (1994). [Eliciting self-explanations improves understanding](https://doi.org/10.1207/s15516709cog1803_3). *Cognitive Science*, 18(3), 439–477.
- Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). [Inducing self-explanation: a meta-analysis](https://doi.org/10.1023/B:EDPR.0000012344.39575.6c). *Educational Psychology Review*, 30, 703–725.
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). [The expertise reversal effect](https://doi.org/10.1080/00461520.2003.10756917). *Educational Psychologist*, 38(1), 23–31.
- Atkinson, R. K., Derry, S. J., Renkl, A., & Wortham, D. (2000). [Learning from examples: instructional principles from the worked examples research](https://doi.org/10.1023/A:1019126019043). *Review of Educational Research*, 70(2), 181–214.
- Renkl, A. (2014). [Toward an instructionally oriented theory of example-based learning](https://doi.org/10.1016/j.edurev.2014.03.002). *Cognitive Science*, 38(1), 1–37.
- Pan, S. C., & Rickard, T. C. (2018). [Transfer of test-enhanced learning: meta-analytic review and synthesis](https://doi.org/10.1037/bul0000151). *Psychological Bulletin*, 144(7), 710–756.
- Kestin, G., Miller, K., Klales, A., Milbourne, T., & Ponti, G. (2025). [AI tutoring outperforms in-class active learning](https://doi.org/10.1038/s41598-025-97652-7). *Scientific Reports*, 15. ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/))
- De Simone, M. E., et al. (2025). [From chalkboards to chatbots](https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099548105192529324). World Bank Policy Research Working Paper 11125. ([Blog](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria))
