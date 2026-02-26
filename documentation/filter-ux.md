In my app, we have a set of filter options (with nested levels) that are available to create segments of items and custom lists. Here's the general structure:

1. At the top level, we have **Filter Categories**.
2. Within a Filter Category, there are **First-order filters** to choose from — these are selectable.
3. Some first-order filters have sub-options: **Second-order filters**, or **sub-filters**.

In practice, this model looks like something like this:

1. Business Type (Filter Category)
  1. Accommodations (First-order)
    1. Cabin (second order)
    2. Cottage (second order)
    3. Campground (second order)
    4. ...
  2. Attractions (First-order)
    1. Arcade (second order)
    2. Cultural Attraction (second order)
    3. ...
  3. Food & Beverage (First-order)
    1. Bar
    2. Cantina
    3. Fine Dining

