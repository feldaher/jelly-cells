Feature: Stages morph smoothly
  Between two stages the anatomy is blended continuously, so the jelly can grow
  a bud, pull in its processes or regrow an axon while it keeps wobbling.

  Scenario Outline: The body halfway between two stages is the average of their shapes
    Given the <type> cell
    When its anatomy is taken halfway between every pair of neighbouring stages
    Then at sample points the body distance is the mean of the two stages' distances
    And at whole stages the anatomy is exactly the built stage

    Examples:
      | type       |
      | yeast      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |

  Scenario Outline: Every in-between stage is a sound soft body
    Given the <type> cell
    When a mesh is built a quarter, half and three quarters of the way between each pair of stages
    Then every tetrahedron has a positive rest volume
    And each in-between volume lies near the range of its two neighbours

    Examples:
      | type       |
      | yeast      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |

  Scenario Outline: Organelles stay inside the cell between stages
    Given the <type> cell
    When its anatomy is taken a quarter, half and three quarters of the way between each pair of stages
    Then every organelle is centred inside the cell or on its surface
    And every tubule runs inside the cell

    Examples:
      | type       |
      | yeast      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |

  Scenario: The bud swells out of the mother
    Given the yeast cell
    When its anatomy is taken at G1, halfway to S, and at S
    Then the cell reaches further along the bud axis at each step
    And halfway there is no separate blob: the cell is one connected body

  Scenario: The daughter nucleus comes out of the mother nucleus
    Given the yeast cell
    When its anatomy is taken just after G2 on the way to anaphase
    Then the new daughter nucleus sits at the mother nucleus and is tiny

  Scenario: A keyframe starts in the old shape and grows into the new one
    Given a yeast cell at G1 resting on the floor
    When a keyframe a quarter of the way to S is swapped in
    Then the new particles start within one lattice spacing of the old surface
    And the cell does not jump: its centre of mass moves less than 0.05 µm
    And after one second the cell reaches further toward the bud than before

  Scenario: Playing the cell cycle morphs to the last stage
    Given a world with the yeast cell at G2
    When it is morphed to telophase and simulated until the morph ends
    Then the world is at the telophase stage with one piece
    And every particle is finite and above the floor
    And the volume is within 10% of rest

  Scenario: A cut cell is made whole before it morphs
    Given a world with the yeast cell at G2 cut in two
    When it is morphed to anaphase
    Then the world is at the anaphase stage with one piece at once

  Scenario: Labels follow the nearest stage
    Given the neuron cell
    When its labels are taken at 2.6 of the way through the injury response
    Then they are the labels of the regeneration stage
