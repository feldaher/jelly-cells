Feature: A budding yeast cell built from tetrahedra
  The intact cell is a mother and a bud fused at a neck, filled with a
  tetrahedral mesh whose elements know which organelle they sit in.

  Scenario: Every tetrahedron is right side out
    Given the default yeast anatomy
    When the simulation mesh is built
    Then every tetrahedron has a positive rest volume

  Scenario: The mesh fills the cell
    Given the default yeast anatomy
    When the simulation mesh is built
    Then the summed tetrahedron volume is within 4 percent of the cell volume

  Scenario: Mother and bud are one body
    Given the default yeast anatomy
    When the simulation mesh is built
    Then the tetrahedra form a single connected component
    And particles exist on both sides of the neck

  Scenario: Organelles give the mesh its materials
    Given the default yeast anatomy
    When the simulation mesh is built
    Then tetrahedra at the surface are cell wall
    And some tetrahedra are nucleus and some are vacuole

  Scenario: The render skin rides inside the mesh
    Given the default yeast anatomy
    When the piece is built
    Then every skin vertex has barycentric weights summing to one
    And every skin vertex is reconstructed from its tetrahedron at rest

  Scenario: The render skin faces outward
    Given the default yeast anatomy
    When the piece is built
    Then almost every skin triangle faces away from the cell
