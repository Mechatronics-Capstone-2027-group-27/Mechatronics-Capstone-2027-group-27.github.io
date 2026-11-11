---
title: "XFOIL Numerical Issues"
date: 2026-11-08
author: david-makarczyk
collaborators: []
timeCommitted: 3
# Posted from issue #25 by @DavidM2004
draft: false
---

# Objectives
One of the critical factors that is slowing the development of the semi-analytical aerodynamics model is the time it takes XFOIL to converge when running the simulations. For example, running a simulation of the glider's performance within the first 10 seconds of flight takes approximately 10 minutes. Although this is not extremely long, it hinders quick iterations when varying parameters.

One of the solutions to such a problem is to pre-compute lift, drag, and moment coefficients in XFOIL outside of the actual simulation, and use lookup tables to rapidly find them while running the simulation. This is the same approach used by most commercial flight simulator software, as it is not practical to run full CFD if a real-time simulation is desired.

# Process
XFOIL is executed from the command line, and can be executed with a prescribed input file. This is the same way that the currently used XFOIL MATLAB wrapper executes runs.  Input files were generated to batch-run series of XFOIL runs on Reynolds numbers ranging from 5000 to 500000 and angles of attack between -10 and +20 degrees, in increments of 0.25 degrees. The output values are then parsed and read into MATLAB matrices for rapid lookup and linear interpolation. 

An expected, good result is shown below:
<img width="2050" height="1255" alt="GoodXFOIL" src="https://github.com/user-attachments/assets/72a29c7e-262c-4de9-a2dd-6d06d8921477" />


# Issues
During this process, several issues were observed in the results, although seemingly all the runs converged.
- Some runs fail to generate any meaningful data, outputting a simple linear relationship, which is evidently non-physical. This is likely to XFOIL's reuse of previous results as starting points for the next iteration. Therefore, if one iteration fails, the entire run fails. See image below:
<img width="2080" height="1230" alt="BadXFOIL" src="https://github.com/user-attachments/assets/7a2638cb-591b-4ddd-9dac-7e44e7c23455" />
- Some runs demonstrate numerical instability at high angles of attack. Notice the oscillations in the image below:
<img width="1950" height="1227" alt="NotSoGoodXFOIL" src="https://github.com/user-attachments/assets/2e61fb58-7bca-4fc3-80f7-b9e89bcea3f3" />
- Stall behavior is not modelled properly. Lift coefficient should drop rapidly after the stall angle (around 11 degrees from literature for the tested NACA 2418 airfoil). None of the XFOIL results demonstrate this. Note that this is a known shortcoming of the fluid dynamics model in the software.
- From XFOIL documentation, convergence is not guaranteed below Re 100000; however, it successfully converged at Re 5000, yet fails at Re 200000, which seems to indicate deeper problems.
- Increasing maximum convergence step threshold does not resolve any of these issues.

# Next steps
Several modifications can be attempted to improve XFOIL performance:
- Use smaller angle of attack steps. This decreases the probability of failed iterations if using the previous result as the new initial condition.
- Manually detect the stall angle as the maximum lift coefficient, and set low lift coefficient for any higher angle of attack.
- Run smaller steps of Re, in the hope that if some of these runs converge, there will be more data to interpolate from.
- Check the airfoil model for NACA 2418. If the default NACA 2418 dat file is corrupted, this may be the source of the unexpected behavior.
