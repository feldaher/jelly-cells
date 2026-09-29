Feature: Seeing deformation
  Besides its anatomy, the jelly can be coloured by how much each part is
  stretched or squeezed: its mechanical strain, shown as "Deformation".

  Scenario: An undeformed cell shows no deformation, even when turned
    Given a yeast cell in its rest shape
    When it is rotated rigidly and its strain is measured
    Then every tetrahedron's strain is zero

  Scenario: Pulling shows up as deformation where the cell is pulled
    Given a yeast cell resting on the floor
    When the mother is held and the bud is pulled away
    Then the strain near the bud is larger than at the far end of the mother

  Scenario: Deformation values stay between zero and one
    Given a yeast cell resting on the floor
    When the deformation view is computed for its skin
    Then every skin value lies between 0 and 1
