Feature: Pieces are solid to each other
  Separate pieces never pass into one another: a particle that ends up inside
  another piece's tetrahedra is pushed back out through that piece's surface.

  Scenario: Cut halves settle without overlapping
    Given a cell cut through the middle of the mother
    When one second is simulated
    Then no particle lies inside the other piece

  Scenario: A half dragged into the other cannot pass through it
    Given a cell cut through the middle of the mother, left to settle
    When the smaller half is dragged into the larger one over one second
    Then no particle ever lies deeper than a quarter of a lattice spacing inside the other piece
    And both pieces keep their volume within 5 percent

  Scenario: A cell dropped on another does not sink into it
    Given two cells, one held above the other
    When the upper cell is dropped and two seconds are simulated
    Then no particle ever lies deeper than a quarter of a lattice spacing inside the other piece
    And no particle lies inside the other piece at the end
