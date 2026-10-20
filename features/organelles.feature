Feature: Organelles placed and sized from measurements
  Where an organelle sits and how large it is follows the published observation,
  at every stage.

  Scenario: A disc primitive is a flat washer
    Given a disc of outer radius 1, inner radius 0.4 and half-thickness 0.05 about the x axis
    When its distance field is sampled
    Then points in the flat ring are inside
    And points in the hole, beyond the rim and off the plane are outside
    And the shader evaluates the same primitive kind

  Scenario: A bowl primitive is a curved sheet
    Given a bowl of radius 2, half-angle 30 degrees and half-thickness 0.05 about the x axis
    When its distance field is sampled
    Then points on the curved sheet are inside, 0.05 from either face
    And the centre of curvature, the far side of the sphere and points past the rim are outside
    And its mesh lies on its own surface
    And the shader evaluates the same primitive kind as the bowl

  Scenario: The budding yeast nucleus keeps 7 percent of the cell volume
    Given the budding yeast cell at every stage
    When nuclear and cell volumes are measured
    Then the nuclear volume is between 5.5 and 8.5 percent of the cell volume at every stage

  Scenario: The budding yeast nucleolus lies opposite the spindle pole
    Given the budding yeast cell at its interphase stages
    When the nucleolus is located
    Then it is on the side of the nucleus away from the neck

  Scenario: The budding yeast spindle elongates through the neck
    Given the budding yeast cell at every stage
    When the spindle is measured
    Then there is no spindle in G1
    And the G2/M spindle fits inside the nucleus
    And the anaphase spindle reaches from the mother into the bud

  Scenario: The budding yeast ring contracts between the split septin rings
    Given the budding yeast cell at every stage
    When the ring at the neck is measured
    Then a ring sits at the neck from bud emergence on
    And at cytokinesis it is smaller than in telophase and lies between the two septin rings
    And the cytokinesis stage carries a fission plane at the neck

  Scenario: The vacuole sends a stream toward the young bud
    Given the budding yeast cell at stage 1
    When its vacuoles are listed
    Then a vacuole tubule runs from the mother vacuole toward the neck

  Scenario: A migrating fibroblast puts its Golgi and centrosome in front of the nucleus
    Given the fibroblast cell at every stage
    When the Golgi, the centrosome and the nucleus are located
    Then every stage has a Golgi next to the nucleus with the centrosome beside it
    And in the migrating cell they lie between the nucleus and the leading edge
    And the migrating nucleus sits behind the middle of the cell body

  Scenario: Myofibroblast adhesions are supermature
    Given the fibroblast cell at every stage
    When the adhesion plaques are measured in micrometres
    Then the migrating cell's adhesions are 2 to 6 long
    And the myofibroblast's adhesions are 8 to 30 long
