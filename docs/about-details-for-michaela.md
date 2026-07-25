# What the About page needs from Michaela

The About Us page is written and live on the branch at `/about`. It carries the mission, her
story, the training she is doing, the four pillars, and the honest-sourcing rule. It is
deliberately not finished, because the most important things on it are hers to decide, not
ours to write.

The page shows a red "draft awaiting Michaela's sign-off" box until everything below is
settled. The box disappears on its own once `src/data/founder.ts` is filled in. Nothing else
has to be remembered or removed.

**Nothing personal on this page publishes until she has read it and signed it off.** The
story was drafted from Liam's account of it, not from her, and the site does not go live with
this page unfinished on her behalf.

## 1. The three answers

| What | Why it is needed | Notes |
|---|---|---|
| **Her sign-off on the story section** | The story is hers. The draft is one telling of it, and how much of it is public is her call alone | Two versions to choose from below. She can also rewrite it entirely in her own words, which would be better than either |
| **The Tellington TTouch course: exact name and provider** | The page says she is training in TTouch. Saying which course, from whom, is what makes it checkable and credible | It stays "training in", never "qualified", until the course is finished |
| **The canine nutrition course: exact name and provider** | Same reason. These two courses are the trust argument for the whole site, so they are stated exactly or not at all | Same rule: in progress until she says otherwise |

## 2. The personal paragraph: two versions, her choice

The middle of the story section touches the hard years. How deep that goes is a decision
about her own privacy, so here are both versions side by side. Swapping one for the other is
a one-paragraph change, and either works with the rest of the page as written.

**Version A, the one on the page now:**

> A few years ago life went hard. There was a stretch when leaving the house felt impossible
> and her mental health took the hit. What she built on the way back is what you are looking
> at: the stall, the shop, and the training she is doing to be better at the work she always
> wanted.

**Version B, the shallower one:**

> The last few years were hard ones, and she rebuilt her life around the thing that had
> always held it together: the dogs. What she built on the way back is what you are looking
> at: the stall, the shop, and the training she is doing to be better at the work she always
> wanted.

Neither version names anything or anyone, and neither ever will. If even version B feels
like too much, the paragraph can come out entirely and the story still stands.

The paragraph about losing the two older dogs and the two new pups is also hers to keep,
soften or cut, and the pups are deliberately not named on the page. If she would like them
named, that is one word each to add.

## 3. The wording is hers to approve

The rest of the page states positions in her name, so she should read it rather than nod at
it. The three worth her attention:

- **"Training, not qualified."** The page says both courses are underway and makes a point of
  not rounding up, with the line "if we would not let a treat label be vague, we do not get
  to be vague about ourselves". That framing turns the unfinished courses into an honesty
  point rather than a weakness, but it commits her to updating the page when they finish.
- **The bigger plan.** The page says the long-term dream is kennels and doggy day care, and
  that Barking Raw funds the way there. That is a real and likeable reason to buy here, but
  it is her plan being made public, so she should be happy saying it out loud.
- **The mission wording.** The claims about supermarket labels ("meat and animal
  derivatives", 2% beef, the propylene glycol and ethoxyquin lines) are the same
  source-checked claims as the landing page, kept deliberately to what the labels and the
  regulators actually say. Nothing on the page claims any food harms dogs.

## 4. What happens after she answers

Her answers go into `src/data/founder.ts`: the two course names replace their PENDING
entries, and `storySignedOff` flips to true once she has approved the story section,
including which version of the personal paragraph stands. The red box then clears itself,
and the page is done.
