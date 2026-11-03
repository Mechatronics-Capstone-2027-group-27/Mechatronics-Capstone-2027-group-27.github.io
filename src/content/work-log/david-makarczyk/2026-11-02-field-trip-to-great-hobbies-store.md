---
title: "Field Trip to Great Hobbies Store"
date: 2026-11-02
author: david-makarczyk
collaborators: [ethan-catz, ian-macpherson, matthew-zelenka]
timeCommitted: 1
# Posted from issue #23 by @DavidM2004
draft: false
---

## What we worked on
General inquiry into RC aircraft design progress. For testing purposes, we plan to lift the glider to altitude under its own power. This will make it easier to test, as our testing will be independent of external constraints and hardware. The design task for this is essentially a remote-controlled plane. 

Questions:
- How are motors characterized (i.e. kv, rated thrust with what prop, etc.)?
- How to properly size a motor for a given mission profile and payload?
- Can any ESC run with any motor as long as amp and volt ratings match?
- Can the ESC and servo drivers talk over UART?
- What is the general design and sizing process for remote controlled aircraft?
- Is it better to tow the glider with a separate plane, or have a propeller in the payload?

## Results
- The proposed testing method with a powered payload is feasible, but may be difficult to find a suitable testing site
- Motors, motor controllers, and batteries contribute a significant mass which does not scale well with decreasing size
- Wing loading is a non-negligible consideration when lifting heavy payloads, most model gliders are not designed for heavy-lift applications
- Dropping a LiPo in the payload may be dangerous

## Next steps
- Motor sizing calculations using MotoCalc software
- Integration of motor sizing calculation results into MATLAB simulation
- Return to Great Hobbies store with calculation results for further info and guidance
