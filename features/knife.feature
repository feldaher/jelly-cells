Feature: A chef's knife
  The knife that comes down on the cell looks like one: a ground steel blade,
  a bolster and a riveted wooden handle. Its cutting edge is the line the physics uses.

  Scenario: The blade keeps the cutting edge the physics presses with
    Given a knife over a yeast cell
    When its mesh is built
    Then the lowest steel vertices lie on the blade plane at the edge height
    And the blade is thicker at the spine than at the edge

  Scenario: The knife has steel, a bolster, a wooden handle and rivets
    Given a knife over a yeast cell
    When its mesh is built
    Then it has blade, bolster, wood and rivet parts
    And the handle lies beyond the heel of the blade
    And every vertex carries knife-local coordinates for the grain and the brushing
    And every normal is unit length
