# Build a Delegable Date-Window Gallery

> Set the boundary once; filter the rows that belong inside it.

_Ported from the authored PL-400 micro-lesson spec PL400-ML-14 (CC BY 4.0, see content/LICENSE)._

## Governing rule {#delegable-date-window-gallery-rule}

A gallery needs a table, so use Filter for all matching rows. Compute a reusable date boundary separately when it makes the data-source predicate simpler, then verify delegation for the actual connector, operators, and column type.

## Exam clue {#delegable-date-window-gallery-exam-clue}

**Many gallery rows → Filter; future date → DateAdd; reusable boundary → Set.**

Mnemonic: DateAdd dates; Filter finds many; LookUp finds one.

## Worked scenario {#delegable-date-window-gallery-scenario}

A Canvas app gallery shows Orders. A delegation warning appears for Filter(Orders, 'Shipping Date' <= DateAdd(Today(), 7, Days)). The exam asks for two formulas: one to calculate a seven-day cutoff and one to return all orders through that cutoff. The options include Set(DateDuration, DateAdd(Today(), 7, Days)), Filter(Orders, 'Shipping Date' <= DateDuration), LookUp(Orders, 'Shipping Date' = DateDuration), and Set(DateDuration, DateDiff(Now(), Today(), Minutes)).

**Expected answer.** The keyed exam answer is Set(DateDuration, DateAdd(Today(), 7, Days)) followed by Filter(Orders, 'Shipping Date' <= DateDuration). Set stores one global scalar date in a behavior property; Filter returns the table a gallery needs. LookUp returns one record, and DateDiff returns a number, not a future date. In production, the phrase 'next seven days' usually requires both a lower and upper date boundary, and delegation must be confirmed against the actual data source.

## Production nuance {#delegable-date-window-gallery-production}

- The MeasureUp answer uses an upper bound only. That is the keyed answer, but it does not by itself mean 'scheduled in the next seven days' because older orders also qualify.
- For a date-only requirement, store StartDate and EndDate, then filter Shipping Date >= StartDate && Shipping Date <= EndDate when that matches the stated inclusive boundary.
- For a date-time requirement that must include all of day seven, use an exclusive upper boundary such as EndExclusive = DateAdd(StartDate, 8, Days) and Shipping Date < EndExclusive.
- A Set variable does not automatically refresh. Update date boundaries on an appropriate lifecycle or refresh action, and validate delegation for the actual connector rather than relying on a generic rule.
