Feature: Morph keyframes are sound soft bodies
  Every in-between stage meshes cleanly, and swapping a keyframe in carries the
  cell on smoothly, up to playing a whole cycle in the world.

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
