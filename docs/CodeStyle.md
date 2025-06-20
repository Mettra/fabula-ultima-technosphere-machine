The purpose of this guidebook is to lay down principles and guidelines for how to write
code and work together in this project.

# OMG-META: About this guidebook

## OMG-META-1: Guidelines are identified by unique identifiers

Each guideline in this document is identified by a unique identifier (`OMG-META-1`) as well as
a name (`Guidelines are identified by unique identifiers`). Names may change, but identifiers are
permanent and can be used to permanently and uniquely refer to a specific guideline.

If a guideline is retired, its identifier will be removed and not used again for other purposes.

## OMG-META-2: Prefer to have things in writing

Rules, guidelines, and work processes should be written down instead of being kept in people's
heads. This makes it easier to refer to them, and discuss them and it makes it easier to onboard
new people to the project.

## OMG-META-3: Purpose of the guidelines

The purpose of this guide is to help programmers who are new to this project write code in proper style and to answer questions programmers might face about how to design or implement
certain things.

* These guidelines are intended to be a practical help, not to cover every possible situation. We
  want to keep this document succinct, so we avoid discussing minutiae or things that are already
  widely known. If something isn't covered by the guidelines and you are uncertain about the best
  approach, look at the surrounding code and follow its example or talk it through with a colleague.

* This is not intended to be a static document. If we notice a problematic pattern in the code or
  think of new advice that will be helpful, we will extend this document with that information.

* Some of the guidelines in this document have good rationales behind them, others are just
  arbitrary choices, but it's better to pick one alternative and be consistent than to have different
  choices all over the code.

* You may find existing code in the codebase that conflicts with the guidelines. That is usually
  because the code was written before the guideline. Resist the urge to go in and "fix" all that
  code. Such fixes do not add much value by themselves and risk introducing new bugs. Instead, only
  fix the code that needs to be updated for other reasons (bug fixes, new features, etc). Fixing
  code that you are already working on anyway is a lot safer because you already have a good
  understanding of the code which makes you less likely to introduce bugs. Also, since you are
  actively working on the code, chances are that if you introduce a bug you will spot it quickly.

# OMG-DESIGN: Design Principles

## OMG-DESIGN-1: Code must be easy to change

The primary purpose of these guidelines is to design code that is easy to change
and adapt to various situations and circumstances.

Being easy to change is the most important property of a codebase as it is the
basis for everything else we want to do with the code. Code that is easy to
change can adapt to new technical requirements or business goals with ease. Code
that can’t change is doomed to stagnate, become technically irrelevant and then
die (when it is easier to throw everything away and start from scratch than to
keep modifying it).

## OMG-DESIGN-2: Less is more

Code is not an asset, it is a liability. The more code you have, the more you have to optimize,
debug, modernize, refactor, understand. In short, the more code you have — the harder it is to
change. A smaller and simpler codebase is easier to understand, improve and extend.

Strategies for keeping the codebase small:

- Be minimalistic: Implement the tiniest thing that solves the current problem. Don’t expect future
  needs. If the code is flexible you can add the functionality when the need occurs.

- Build more advanced things out of a few simple building blocks. Arrays and hash tables should
  cover almost all of your data type needs.

- Actively prune unused code paths.

- Refactor out unneeded complexity whenever you can. Strive to make the code as small and simple as
  possible.

- Never leave commented out code in the project. That’s what version history is for.

“Less is more” is not just about physical lines of code, it is also about adding other unnecessary
stuff. An external library does not add any code to the repository, but it adds dependencies and
conceptual complexity — more things that you need to understand and more things that can go wrong.

Strategies for keeping conceptual complexity down:

- Don’t introduce unnecessary abstraction layers, prefer simpler concepts (`char *` over
  `std::string`). Only abstract when it brings clear value.

- Don’t add new programming languages to the codebase. We strive to do everything with C, so
  developers only need to learn one language, one debugger, etc.

- Minimize the use of external libraries. Prefer minimalistic one-file libraries over bigger ones.

It can be tempting to rely on an external library as a quick way of implementing a feature. But be
wary. Code in external libraries is hard to modify, which violates our first principle. First, you
have to understand the external codebase, which can be daunting, and then you either have to fork,
which means you take over the maintenance burden or deal with the politics of pushing the changes
upstream. The bigger and more complicated the library is, the harder this problem gets.

If you only need a small functionality, consider just implementing that instead of adding a library
dependency.

## OMG-DESIGN-3: Keep it simple

Simpler solutions are easier to understand, easier to reason about, and easier
to modify.

What is “simple” can be discussed. From our perspective it means:

- Fewer levels of abstraction.
- Easier to understand *completely* (performance implications, threading implications, etc).
- Easier to debug.
- More straightforward and easier to follow logic.
- Closer to the metal.

Examples:

- Immutable is simpler than mutable.
- Non-generic code is simpler than generic code.
- Single-threaded is simpler than multi-threaded.
- boost libraries are not simple.

Sometimes complexity is needed. For example, you can’t get good performance on
modern hardware without multi-threading and some mutability. The point is to
keep things as simple *as possible.*

Use a limited set of core data structures and concepts. Use established
standards *when they are simple:*

- Simple standards: JSON, Web sockets, UTF-8.
- Complicated standards: XML, Corba, UTF-16.

## OMG-DESIGN-4: Explicit is better than implicit

It is better when programmers can see what is going on than when it is hidden. Avoid doing cute
tricks with templates and macros. Think about code that is easy to understand and step through in a
debugger.

## OMG-DESIGN-6: Design for fast iterations

For modifications to be easy, the modify-build-test cycle must be fast.

Minimizing build times ensures that programmers stay productive. This is accomplished by minimizing
header inclusion and avoiding known costly constructs, such as heavy use of C++ templates.

Unit tests should be used as much as possible to verify the correctness of the code. This allows
changes to be made with greater confidence and less manual testing, which means changes can be made
faster. These unit tests should be fast enough to run as a part of the standard build.

Unit tests provide the most value for *complicated low-level code*, such as JSON parsing and
complicated data structures (*The Truth*). *Simple* low-level code (e.g., vec3 addition) is unlikely
to be changed a lot and see regression bugs. And even if it does have bugs, they are usually easy to
spot and fix. Thus, unit tests provide limited value. *High-level* code (e.g., UI) is hard to test
with unit tests and usually better tested in other ways (hands-on or through recorded UI interaction
sessions).

Hot-reloading of DLLs should be supported to provide quick testing of changes in a running
application.

Be mindful of the application's boot time. The boot time is a fixed cost that everyone has to pay
whenever they want to test anything in the application. Faster boot times means faster iterations.

## OMG-DESIGN-7: Deliver changes quickly

The path from implementing a feature to delivering it to the end user should be short.

Regardless of the benefits to end users, there are also many advantages to delivering changes fast
*internally.* When we integrate often and quickly, designs can be validated earlier, bugs can be
discovered sooner and everybody gets on the same page about the current status of the project.

To achieve fast delivery we discourage long-lived branches. Users should be working against the
trunk as much as possible. Instead of using branches, experimental and unfinished features should be
protected by feature flags. Such feature flags can also be used for quick rollback if critical bugs
are discovered.

## OMG-DESIGN-8: Avoid coupling

Avoid complicated dependencies between systems. These make the codebase harder
to understand and modify. It should be possible to modify, optimize or replace
each system on its own.

Use abstract interfaces to access shared services such as logging, file systems,
memory allocation, etc. That way, these systems can be replaced or mocked for
unit tests.

## OMG-DESIGN-9: Follow Data Oriented Design principles

Design your systems around data layouts and data flows first. Memory throughput
is often the limiting factor of software performance. Make sure your data
layouts and access patterns are cache friendly. Don’t abstract away the nature
of the hardware.

Avoid object-oriented design principles. They encourage heap allocated
individual objects with data hidden behind accessor functions. This leads to bad
data access patterns and code flows that are hard to optimize and multi-thread.
Instead, lay out the data in the most efficient way and then write functions to
operate on that data.

Multi-threaded, job-based parallelism should be considered the norm for any
high-throughput system.

## OMG-DESIGN-10: Shared responsibility

The codebase should be the shared responsibility and pride of every developer
that works on it.

If you see a problem, it is your problem. Don’t wait for somebody else to fix
it. Fixing issues in parts of the code you’re not familiar with is a good way of
understanding more of the codebase. Of course, reach out to the people who know
that part of the code, to help you understand it better, and verify that your
fix is the right one.

When you deliver a feature or a new system, you are responsible for the whole
delivery. Design, clean code, documentation, testing, performance, knowledge
sharing, etc. A feature is not done just because it works. When you go in to
make a change, you should always leave the code in a better state than you found
it: cleaner, simpler, faster, easier to understand.

When you are fixing a bug, don’t just fix the bug. Ask yourself what the
underlying cause was that made the bug slip through compilation, unit tests,
developer tests, and QA. Can you somehow write the code so that bugs like this
can be detected at compile time? Can you add a unit test that detects the bug?
Can you add an assert that prevents misuse of the functions? Can you improve the
function names and/or the documentation to make misuse less likely?

When you are responding to questions, consider adding them to an FAQ or
clarifying the code documentation, so that you won’t have to answer the same
question again.

## OMG-DESIGN-11: Write for readability

Code is read more often than it is written. Write your code so that it is easy to read and
understand for a new programmer (or for yourself coming back to the code later).

Code should aim to be plain and straight forward. Avoid tricky constructs, trying to be clever and
showing off your programming skills.

It is not always 100 % clear cut what is an "unreadable clever hack" and what is a "common
programming idiom". For example, consider this code for setting a bit in an integer:

~~~c
flags |= (1ULL &lt;&lt; TM_RENDER_FLAG__CAST_SHADOWS);
~~~

For someone not used to bit twiddling this may seem like a "hack". However, for someone used to bit
twiddling, this is just the standard way of setting a bit and adding an abstraction around it (such
as a `SET_BIT()` macro) is just obfuscating things.

Familiarize yourself with the idioms that are commonly used in this project by reading the code.