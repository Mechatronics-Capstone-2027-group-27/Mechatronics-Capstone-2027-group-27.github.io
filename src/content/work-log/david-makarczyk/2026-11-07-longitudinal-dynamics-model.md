---
title: "Longitudinal Dynamics Model"
date: 2026-11-07
author: david-makarczyk
collaborators: []
contributions:
  david-makarczyk: |-
    # Overview
    The point-particle kinematics model does not accurately reflect the kinematics of the glider. Most importantly, it cannot identify a stall, it cannot differentiate between different angles of attack; and so consequently it is not capable of varying lift and drag coefficients as a function of flight conditions. 

    # Implementation
    - The glider was modelled as a simple wing and horizontal stabilizer system, with the center of gravity located forward of the wing and stabilizer. 
    - Relative dimensions and aspect ratios were taken from a photo of the StratoDynamics HiDRON glider.
    - Both symmetric (NACA 0012) and asymmetric (NACA 2418) airfoils were used, with asymmetric airfoils showing better performance in generating negative lift on the stabilizer.
    - The stabilizer angle of attack was positioned at 3 degrees below the angle of attack of the wing to account for downwash off the end of the wing.
    - Angle of attack was calculated as the angle between the relative airflow and the airfoil angle. 
    - Lift forces and airfoil pitching moments were implemented as acting through the center of lift of the airfoil.

    # Results
    The model shows dynamic pitching-up moments within the first 10 seconds of flight, exceeding physically possible flight angles. It is not capable of accurately modeling stall dynamics and has negative stability. This is likely due to a missing aerodynamic damping coefficient in the pitch equation, which is yet to be implemented.

    # Next Steps
    - Pitch damping coefficient implementation
    - Stall detection and modified post-stall physics model
    - Dynamic stability evaluation
timeCommitted: 2
hoursByMember:
  david-makarczyk: 2
# Posted from issue #29 by @DavidM2004
draft: false
---

NaN
