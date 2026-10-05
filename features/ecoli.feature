Feature: The E. coli cell cycle
  A bacterium: no nucleus and no organelles, a nucleoid that is replicated and
  segregated as the rod elongates, and a Z ring that closes the cell in the middle.

  Scenario Outline: Every stage is a sound soft body with honest labels
    Given the E. coli cell at stage <stage>
    When its simulation mesh is built
    Then every tetrahedron has a positive rest volume
    And the tetrahedra form a single connected component
    And the particle count stays within the real-time budget
    And every label anchor lies inside the cell
    And every label with a material sits inside that material

    Examples:
      | stage |
      | 0     |
      | 1     |
      | 2     |
      | 3     |
      | 4     |

  Scenario: A bacterium has a nucleoid and no membrane-bound organelles
    Given the E. coli cell at every stage
    When its organelles are listed
    Then there is no nucleus, nucleolus, mitochondrion, vacuole or Golgi
    And there is a nucleoid at every stage

  Scenario: The rod elongates exponentially at constant width
    Given the E. coli cell at every stage
    When its length and width are measured in micrometres
    Then each length is the exponential law at that stage's age
    And the width away from the waist is 1.0 at every stage

  Scenario: The nucleoid stays clear of the poles and splits at termination
    Given the E. coli cell at every stage
    When the nucleoid is measured
    Then no nucleoid comes within 0.25 micrometres of a pole
    And the newborn cell has one nucleoid and later stages have two
    And two nucleoids lie on either side of the middle

  Scenario: The Z ring appears at termination and closes with the waist
    Given the E. coli cell at every stage
    When the Z ring and the waist are measured
    Then the newborn cell has no Z ring
    And from termination to constriction there is a Z ring at the middle
    And the ring fits inside the waist at every stage
    And the Z ring has left by the time the septum closes
    And the waist narrows from one stage to the next once constriction has begun

  Scenario: Division leaves two daughters joined by a narrow bridge
    Given the E. coli cell at stage 4
    When its anatomy is built
    Then the waist at the middle is less than 40 percent of the cell width
    And the anatomy carries a fission plane through the middle
    And each half has a nucleoid
