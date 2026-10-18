---
title: "Launch concept criteria meeting + meeting transcription workflow"
date: 2026-10-18
author: ethan-catz
collaborators: [david-makarczyk, nitya-singh, matthew-zelenka]
timeCommitted: 0.7
# Posted from issue #19 by @MystyM
draft: false
---

## Who did what

* [Ethan Catz](https://mechatronics-capstone-2027-group-27.github.io/work-log/ethan-catz/)
  Author · Time committed: 0.7 h
  What I worked on
    * Built a workflow to turn recorded team calls into meeting notes
    * Transcription with Whisper large-v3, with speakers labelled by matching voices against a reference clip from each member
    * Condensed the 2026-10-17 transcript into structured notes: decisions, matrix criteria, open questions and action items
  Results
    * Meeting notes for the 2026-10-17 launch concept call, with every point attributed to the right speaker
    * Anyone who misses a call can catch up from the notes, and decisions are recorded instead of living in a voice chat
  Next steps
    * Run the workflow on future team meetings
    * Fold the agreed criteria into the decision matrix for the presentation

* [David Makarczyk](https://mechatronics-capstone-2027-group-27.github.io/work-log/david-makarczyk/)
  Collaborator · Time committed: 0.7 h
  What I worked on
    * Reframed the pitch: replace the heavy control box (gyros or thrusters) and its parachute with a glider
    * Laid out the concept elimination logic: a ground rocket fails on cost, a balloon alone fails on altitude, which leaves balloon + rocket
    * Defined units for each matrix criterion and posted the final criteria and constraints to the team chat
  Results
    * Nine matrix criteria agreed: launch system cost ($), launch infrastructure cost ($), launch system weight (kg), payload capacity (kg), vertical precision (km), horizontal precision (km), ETA / flight time (min), ETA consistency (min), recovery radius precision (km)
    * Recovery radius adopted as the measure of safety
  Next steps
    * Finalize the constraints list beyond "payload survives"
    * Confirm the target altitude (about 80 km was said in the call, but the matrix reasoning assumes about 30 km)

* [Matthew Zelenka](https://mechatronics-capstone-2027-group-27.github.io/work-log/matthew-zelenka/)
  Collaborator · Time committed: 0.7 h
  What I worked on
    * Argued for one full matrix, so the ground rocket is scored on every criterion rather than cut early
    * Proposed ETA and ETA consistency as criteria, and split cost and weight into launch system vs payload
    * Argued that launch infrastructure, not payload damage, is what eliminates the railgun
  Results
    * Single matrix with all nine concepts adopted
    * Specs that every concept already meets (e.g. temperature) removed from the constraints
  Next steps
    * Find how high a ground-launched rocket gets during its roughly 12 s burn

* [Nitya Singh](https://mechatronics-capstone-2027-group-27.github.io/work-log/nitya-singh/)
  Collaborator · Time committed: 0.7 h
  What I worked on
    * Raised whether to cut down the constraints from the previous presentation
    * Proposed orientation accuracy and response time as ways to measure maneuverability
    * Suggested separate matrices for launch method and balloon variants
  Results
    * Constraints will be rewritten to be solution-neutral, based on the need and problem statement
    * Glider-specific specs (roll rate, pitch rate) to be dropped
  Next steps
    * Rewrite objectives, constraints and criteria to be solution-neutral
