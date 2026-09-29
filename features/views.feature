Feature: Seeing strain and stiffness
  Besides its anatomy, the jelly can be coloured by how much each part is
  stretched (strain) or by how stiff its material is.

  Scenario: An undeformed cell shows no strain, even when turned
    Given a yeast cell in its rest shape
    When it is rotated rigidly and its strain is measured
    Then every tetrahedron's strain is zero

  Scenario: Pulling shows up as strain where the cell is pulled
    Given a yeast cell resting on the floor
    When the mother is held and the bud is pulled away
    Then the strain near the bud is larger than at the far end of the mother

  Scenario: The stiffness view shows the wall stiffer than the cytoplasm
    Given a yeast cell resting on the floor
    When its stiffness field is computed
    Then surface particles are stiffer than the particles in the middle

  Scenario: View values stay between zero and one
    Given a yeast cell resting on the floor
    When the strain and stiffness views are computed for its skin
    Then every skin value lies between 0 and 1
