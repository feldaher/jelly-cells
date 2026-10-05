Feature: The budding yeast cell cycle
  A slider steps the yeast cell through G1, S, G2/M, anaphase, telophase and cytokinesis:
  the bud grows, the nucleus migrates into the neck, stretches through it and splits,
  and the neck closes between mother and daughter.

  Scenario Outline: Every stage is a sound soft body with honest labels
    Given the yeast cell at stage <stage>
    When its simulation mesh is built
    Then every tetrahedron has a positive rest volume
    And the tetrahedra form a single connected component
    And every label anchor lies inside the cell
    And every label with a material sits inside that material

    Examples:
      | stage |
      | 0     |
      | 1     |
      | 2     |
      | 3     |
      | 4     |
      | 5     |

  Scenario: The bud grows through the cycle
    Given the yeast cell at every stage
    When the cell volumes are measured
    Then each stage up to telophase is larger than the one before

  Scenario: A G1 cell has no bud yet
    Given the yeast cell at stage 0
    When its anatomy is built
    Then its body is the mother alone
    And there is no septin ring

  Scenario: In anaphase the nucleus spans the neck
    Given the yeast cell at stage 3
    When its anatomy is built
    Then there is nucleus on both sides of the neck
    And it is one connected nucleus

  Scenario: In telophase there are two nuclei and two septin rings
    Given the yeast cell at stage 4
    When its anatomy is built
    Then there is nucleus on both sides of the neck
    And the two nuclei are separate
    And there are two septin rings

  Scenario: At cytokinesis the neck closes
    Given the yeast cell at stage 5
    When its anatomy is built
    Then the neck is narrower than in telophase
    And there is a septum across the neck
    And the two nuclei are separate
