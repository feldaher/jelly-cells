Feature: The cell wobbles like jelly
  XPBD with Neo-Hookean tetrahedra, a floor with friction and damping that
  acts only on relative motion.

  Scenario: A cell left on the floor comes to rest
    Given an intact cell resting on the floor
    When two seconds are simulated
    Then the kinetic energy is almost zero
    And the volume is within 2 percent of rest

  Scenario: Damping does not slow a falling cell
    Given an intact cell high above the floor
    When a tenth of a second is simulated with syrupy damping
    Then the centre of mass has accelerated at g

  Scenario: A stretched cell keeps its volume
    Given an intact cell resting on the floor
    When the mother is held and the bud is pulled far away over one second
    Then the cell is visibly longer than at rest
    And the volume is within 4 percent of rest

  Scenario: An inverted tetrahedron recovers
    Given an intact cell high above the floor
    When one particle is pushed through its tetrahedron and one second is simulated
    Then no tetrahedron is inverted

  Scenario: Firmer jelly sags less
    Given an intact cell resting on the floor
    When it settles once trembling and once set
    Then the set cell is taller than the trembling cell
