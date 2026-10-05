# Full browser interview transcript

Fictional development student. All eight answers entered through the actual UI; these are not the user’s scores.

Model: qwen3:4b-instruct. Completed: 2026-10-04T07:53:33.888Z. Six scored questions, eight recorded attempts.

**Aria:** Explain the difference between mutable and immutable Python objects. Give one bug that shared mutable state can cause.

**Test student:** Lists and dictionaries are mutable; their contents can change in place. Strings and integers are immutable. Two names can refer to the same list, so appending through one name changes what the other sees. A mutable default list is reused across function calls and leaks old items. Use None as the default and create a fresh list inside each call.

**Aria:** Good explanation of mutable vs immutable objects and a real shared-state bug. How would you modify a function to avoid reusing a mutable default argument?

**Test student:** Use def add(value, items=None), then if items is None create items = [], append value and return items. Each call without items gets a fresh list. The old default list was one mutable object shared across calls; rebinding immutable objects such as strings cannot mutate that list.

**Aria:** Good point about shared state—how does this differ from reassigning an immutable object like a string? How would you design error handling for a function that reads and validates a user-supplied file without hiding programming defects?

**Test student:** I validate the allowed content type and size before parsing a user-supplied file. I open it with a context manager so the resource closes on failure. I catch expected PermissionError, FileNotFoundError and documented parser errors, then return an actionable message. Unexpected programming defects propagate to the error boundary with a traceback; I never blanket-catch every exception and return success.

**Aria:** You correctly identify specific exception handling and input validation—well done on avoiding blanket catches. Your resume mentions: "Built a local placement tracker with Python and SQLite.". Choose one project decision you made. Explain the constraint, alternatives you considered, why you chose it, and how you verified the result.

**Test student:** I chose SQLite for an offline single-user placement tracker. The constraint was no internet and no server administration budget. PostgreSQL was an alternative for concurrent users, but required a server. SQLite offered one local file and simple installation; its trade-off is limited concurrent writes. I verified persistence by saving and reopening applications, checked rollback after failed updates, and measured list-query latency with 10,000 fixture rows.

**Aria:** You correctly identified SQLite's trade-off and verified it with measurable tests—strong work on validation. Your resume mentions: "Built a local placement tracker with Python and SQLite.". Describe a difficult defect in one of your projects. How did you isolate the cause, what evidence changed your hypothesis, and what prevented regression?

**Test student:** My tracker sometimes duplicated an application after reopening it. I reproduced the defect with one record, saved the SQL trace and found two INSERT statements. I first suspected loading the database twice, but the trace showed that two click handlers ran for one Save click. I removed the duplicate event binding, used a unique application key, and added a regression test asserting that one click creates exactly one row and that reopening keeps the same count.

**Aria:** You correctly identified the root cause through trace evidence—strong reasoning on defect isolation. What observation falsified the hypothesis that the database was loaded twice?

**Test student:** The startup log showed only one database connection and one SELECT during reopening, so loading twice did not fit the evidence. For a single Save click, tracing instead showed two handler entries and two INSERTs. Removing one duplicate binding eliminated the reproduction. I kept a regression test that dispatches one Save click and checks exactly one inserted row, then reopens the database and checks that the count stays one.

**Aria:** You correctly identified the root cause through trace evidence and implemented a regression test—strong reasoning on defect isolation. Compare INNER JOIN and LEFT JOIN. When can a LEFT JOIN unexpectedly reduce to inner-join behaviour?

**Test student:** INNER JOIN returns only matching rows from both tables. LEFT JOIN retains every left row and fills unmatched right columns with NULL. A WHERE predicate on a right-side column, such as r.status = active, rejects NULL extended rows and effectively removes unmatched records. Put that right-side filter in the ON clause when all left rows must survive.

**Aria:** You correctly explain both joins and the filtering effect on unmatched rows. A query filtering by user_id and sorting by created_at is slow. How would you investigate and choose an index?

**Test student:** I first measure the slow query on representative data and inspect EXPLAIN QUERY PLAN to see scans and temporary sorting. For WHERE user_id = ? ORDER BY created_at, I would test a composite index on (user_id, created_at): equality narrows the prefix and the next column supplies sort order. I check selectivity and existing indexes, compare latency and the new plan, and account for extra disk space and slower inserts or updates. I would not add an index without measuring.

**Aria:** You correctly identify the execution plan and propose a composite index with proper column order and trade-offs.

Actual test score: 100/100. This is a fictional fixture result, not the user’s assessment.

The UI test exposed an acknowledgement with an extra question at turn 2. The final implementation now validates reactions contain no question mark and retries invalid replies; later UI turns and the final strong/weak tests use that check. Saved transcripts preserve what the model actually said.