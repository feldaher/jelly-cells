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

  Scenario: Labels follow the nearest stage
    Given the neuron cell
    When its labels are taken at 2.6 of the way through the injury response
    Then they are the labels of the regeneration stage
