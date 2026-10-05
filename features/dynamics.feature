Feature: Organelles that look and move as measured
  Shapes and motions of organelles come from published measurements. Motions run in the
  shader, sped up by a stated factor, from one table of rates shared with the code.

  Scenario: Titles are set the same way for every cell
    Given every cell type
    Then each title is one or two lines and ends with a full stop
    And no title breaks a word across lines
    And the lines of a title spell the cell's name

  Scenario: Fission yeast microtubules grow, pause at the tip and collapse
    Given the table of organelle motions
    When a microtubule end is followed through one cycle in a 14 micrometre cell
    Then it grows at 1.86 micrometres per minute
    And it stays at the tip for 1.5 minutes
    And it shrinks faster than it grew, back toward the nucleus
    And the cycle repeats

  Scenario: The rates reach the shader from the same table
    Given the table of organelle motions
    When the shader constants are generated
    Then every rate and its speed-up appear in them
    And the organelle shader uses them

  Scenario: Tubes carry their length to the shader
    Given the fission yeast cell in late G2
    When its organelle meshes are built
    Then every microtubule vertex is flagged as moving and carries its distance along the tube
    And other organelles are not flagged as moving
    And a mitochondrion's vertices run from zero to its length

  Scenario: The budding yeast mitochondrion is as thick as measured
    Given the budding yeast cell at every stage
    Then its mitochondrial tubules are 0.34 micrometres across

  Scenario: The yeast nuclear envelope carries the measured number of pores
    Given the table of organelle motions
    Then the pore pattern gives between 65 and 182 pores on a budding yeast nucleus

  Scenario: The Golgi is a ribbon of stacks of seven cisternae
    Given the fibroblast cell at every stage
    Then its Golgi is three stacks of seven flat cisternae

  Scenario: Nissl bodies are stacks of flat cisternae
    Given the neuron cell at every stage
    Then every Nissl body is a stack of three flat cisternae

  Scenario: Mitochondria travel along the healthy axon in both directions
    Given the neuron cell at every stage
    Then the healthy axon has a track of moving mitochondria each way
    And a cut axon keeps its tracks inside the stump
