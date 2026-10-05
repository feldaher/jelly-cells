Feature: Cell-cycle laws taken from measurements
  The growth and division of each dividing cell is driven by functions of the cycle
  phase whose constants come from published measurements.

  Scenario: Fission yeast grows in two linear segments and then stops
    Given the fission yeast length law
    When the length is read at birth, at new end take-off, at the end of growth and at division
    Then the lengths are 7, 9.5, 14 and 14 micrometres
    And the cell grows faster after new end take-off than before
    And only the old end has grown before new end take-off

  Scenario: The fission yeast nucleus keeps 8 percent of the cell volume
    Given the fission yeast length law
    When the nucleus radius is computed at birth and at division
    Then the nuclear volume is 8 percent of the rod volume both times
    And two daughter nuclei together have the volume of the mother nucleus

  Scenario: E. coli elongates exponentially
    Given the E. coli growth law
    When the length is read at birth, at half a generation and at division
    Then the lengths are 2.2, 2.2 times the square root of two, and 4.4 micrometres

  Scenario: E. coli replication rounds overlap in fast growth
    Given the E. coli growth law
    When the replication state is read through the cycle
    Then a newborn cell carries a chromosome that is 70 percent replicated
    And the next round starts at 4 minutes and the old one ends at 12 minutes
    And the cell has one nucleoid before termination and two after
    And it has two origins before initiation and four after

  Scenario: The Z ring is there before the cell constricts
    Given the E. coli growth law
    When the waist is read through the cycle
    Then the Z ring assembles at the start of the D period
    And the waist is full at that time and closed at division
    And it never widens
