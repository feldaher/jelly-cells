Feature: The fission yeast cell cycle
  A rod that grows at its tips, divides its nucleus inside an intact envelope, builds a
  septum across its middle and splits into two equal daughters.

  Scenario Outline: Every stage is a sound soft body with honest labels
    Given the fission yeast cell at stage <stage>
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
      | 5     |
      | 6     |

  Scenario: The rod grows in length, not in width
    Given the fission yeast cell at every stage
    When its length and width are measured in micrometres
    Then the first three lengths are 7, 9.5 and 14
    And the width is 3.6 at every stage
    And the length stays at 14 through mitosis and septation

  Scenario: The new end takes off only after NETO
    Given the fission yeast cell at every stage
    When the distance from the birth scar to the new end is measured
    Then it is the same at birth and at NETO
    And it is longer in late G2

  Scenario: The interphase nucleus sits in the middle and scales with the cell
    Given the fission yeast cell at its three interphase stages
    When the nucleus is measured
    Then it is centred on the middle of the cell
    And its volume is 8 percent of the cell volume, within one standard deviation
    And microtubule bundles run from the nucleus toward both tips

  Scenario: Metaphase has a spindle inside the nucleus and a ring around the middle
    Given the fission yeast cell at stage 3
    When its anatomy is built
    Then the spindle lies inside the nucleus
    And a ring circles the middle of the cell just under the wall
    And there are no interphase microtubule bundles

  Scenario: Anaphase B pushes two nuclei toward the ends
    Given the fission yeast cell at stage 4
    When its anatomy is built
    Then there are two nuclei more than 6 micrometres apart
    And the spindle joins them and is no longer than the longest measured spindle
    And the ring has not started to close

  Scenario: The septum grows inward behind the closing ring
    Given the fission yeast cell at stage 5
    When its anatomy is built
    Then the septum is a washer with a hole
    And the ring lines the hole
    And each half has a nucleus near its own middle
    And no mitochondrion crosses the septum
    And the outline of the cell is still a cylinder

  Scenario: Fission leaves two daughters joined by a narrow bridge
    Given the fission yeast cell at stage 6
    When its anatomy is built
    Then the septum is closed
    And the waist at the middle is less than 60 percent of the cell width
    And the anatomy carries a fission plane through the middle
    And each half has a nucleus, mitochondria and vacuoles
