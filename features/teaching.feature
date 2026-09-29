Feature: Teaching aids
  Labels, a key that shows and hides organelles, a readout of what each cut
  passed through, and a scale bar.

  Scenario: A cut through the nucleus reports it
    Given the yeast cell type
    When the section through the nucleus centre is measured
    Then the report lists the nucleus
    And its width is close to the nucleus diameter

  Scenario: A cut that misses the nucleus does not report it
    Given the yeast cell type
    When a section through the far end of the mother is measured
    Then the report does not list the nucleus

  Scenario: Mitochondria are counted profile by profile
    Given the yeast cell type
    When the section through the nucleus centre is measured
    Then mitochondria are reported as separate profiles

  Scenario: The scale bar picks a round length
    Given a zoom of 37 pixels per micrometre
    When the scale bar is chosen
    Then its length is a round number of micrometres
    And it is between 50 and 160 pixels wide

  Scenario: Crowded labels do not overlap
    Given twelve labels anchored close together
    When the labels are laid out
    Then no two label boxes overlap

  Scenario Outline: Every label links to Wikipedia
    Given the <cell> cell type
    When its labels are listed at every stage
    Then each label links to an English Wikipedia article

    Examples:
      | cell       |
      | yeast      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |
