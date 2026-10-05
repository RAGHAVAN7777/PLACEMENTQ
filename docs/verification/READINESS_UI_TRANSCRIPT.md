# Complete integrated interview — actual UI test

Fictional student. Actual qwen3:4b-instruct responses through the backend; 8 answers, 6 scored question groups. Baseline 99.87450907568426; interview 100; composite 99.94. The baseline model was unchanged.

Saved report: report_7ecf6466-917e-4ac6-a838-b11b19e72f90

**Aria**
Explain the difference between mutable and immutable Python objects. Give one bug that shared mutable state can cause.

**Test student**
Lists and dictionaries are mutable: their contents can change in place. Strings, tuples and integers are immutable. Two names can reference the same list, so appending through one name changes what the other sees. A list used as a default argument is created once and reused across calls, leaking items between calls. I use None as the default and create a fresh list inside each call.

**Aria**
The shared state bug in default arguments is well explained and correctly identified. How would a function with a mutable default argument behave if called multiple times with no explicit list creation?

**Test student**
For def add(x, items=[]): items.append(x); return items, the default list is created once at function definition. add(1) returns [1]; add(2) then returns [1, 2], not a fresh [2], because both calls reuse the same mutable list. Fix it with items=None, then if items is None: items=[] inside the function. Each call then gets a fresh list, while an explicitly supplied list still retains caller-visible changes.

**Aria**
You correctly explain how shared mutable state leads to unexpected behavior across function calls. How would you design error handling for a function that reads and validates a user-supplied file without hiding programming defects?

**Test student**
I use a with open context manager so the file closes even on failure. I catch FileNotFoundError and PermissionError around opening, UnicodeDecodeError for decoding, and a narrow ValueError for expected validation failures. I validate required columns and types and report an actionable message with the bad field. I do not use bare except or catch Exception around everything: unexpected TypeError or assertion failures should propagate with a traceback rather than look like bad user input. I test missing files, denied access, malformed content, valid content and unexpected parser defects.

**Aria**
You correctly identify specific exception boundaries and avoid suppressing unexpected defects. How would the error handling differ if a parser raised a TypeError due to invalid data format, not user input?

**Test student**
I would check the parser contract first. If its documentation explicitly uses TypeError for malformed external data, I catch TypeError only around that parser call and translate it into a domain validation error with the original exception chained. I do not catch TypeError around the entire function, because my own indexing or argument mistakes must still propagate. I validate input types at the boundary and add separate tests for malformed data and a deliberately broken parser to prove programming defects are not swallowed.

**Aria**
You correctly address specific exception handling and input validation at the boundary. Your resume mentions: "I built a Python and SQLite application to manage job applications offline, validate input, run parameterized queries, and preserve records across restarts.". Choose one project decision you made. Explain the constraint, alternatives you considered, why you chose it, and how you verified the result.

**Test student**
For the fictional placement tracker, the constraint was offline operation on one laptop with records surviving restarts. I chose SQLite transactions and parameterized queries. I considered JSON files, which are simple but require manual locking and recovery, and PostgreSQL, which supports many simultaneous users but requires a separate server. SQLite fits single-user deployment; it is a trade-off because concurrent writers are limited. I verified persistence by inserting an application, restarting the process and reading it back. I tested rollback on invalid input, a unique constraint for duplicate applications, and quotes in user input to ensure parameters are treated as data.

**Aria**
You correctly identify SQLite transactions as a key decision under offline constraints. Your resume mentions: "I built a Python and SQLite application to manage job applications offline, validate input, run parameterized queries, and preserve records across restarts.". Describe a difficult defect in one of your projects. How did you isolate the cause, what evidence changed your hypothesis, and what prevented regression?

**Test student**
In this fictional test project, a record appeared after saving but disappeared on restart. My first hypothesis was that the read query filtered it incorrectly. I reproduced the issue with a temporary database and inspected the row through a second connection before shutdown: the second connection could not see it. That evidence pointed to an uncommitted transaction rather than filtering. I traced the write path and found an early return before commit. I moved the transaction into a context manager that commits on success and rolls back on failure. A regression test inserts a record, closes the connection, reopens the database and asserts the same row exists; another test verifies failed validation leaves no partial row.

**Aria**
You correctly identify the symptom and use evidence to isolate the root cause of the transaction issue. Compare INNER JOIN and LEFT JOIN. When can a LEFT JOIN unexpectedly reduce to inner-join behaviour?

**Test student**
INNER JOIN returns only matching rows. LEFT JOIN retains every left-side row, with NULL values for unmatched right-side columns. A WHERE condition on a right-side column such as WHERE jobs.status = active filters out those NULL-extended rows, effectively removing unmatched left rows and behaving like an inner join. If I want all applicants and only their active jobs, I put the status predicate in the ON clause: applicants LEFT JOIN jobs ON jobs.applicant_id = applicants.id AND jobs.status = the active parameter. I test applicants with zero jobs, only inactive jobs, and multiple active jobs; multiple matches correctly produce multiple rows.

**Aria**
You correctly explain both joins and the filtering effect on unmatched rows. A query filtering by user_id and sorting by created_at is slow. How would you investigate and choose an index?

**Test student**
First I measure the query on representative data and inspect EXPLAIN QUERY PLAN for a full table scan or a temporary sort. For WHERE user_id = ? ORDER BY created_at, I would test a composite index on (user_id, created_at): equality on the leading column narrows the range and the second column provides ordered rows for that user. I compare the plan and latency before and after, including users with few and many rows and any LIMIT. I check existing indexes and avoid redundant ones. An index costs storage and slows inserts and updates, so I benchmark that too; stale statistics, selecting many columns, and low selectivity can affect whether the planner uses it.

**Aria**
You correctly identify the execution plan and propose a valid composite index with appropriate trade-off considerations.

