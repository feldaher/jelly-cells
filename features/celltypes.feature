Feature: A gallery of cell types
  Every cell type in the dropdown is a sound soft body with its own anatomy,
  and its teaching labels point at what they name.

  Scenario Outline: Every cell type builds a sound soft body
    Given the <type> cell type
    When its simulation mesh is built
    Then every tetrahedron has a positive rest volume
    And the tetrahedra form a single connected component
    And the summed tetrahedron volume is within 6 percent of the body volume
    And the particle count stays within the real-time budget

    Examples:
      | type       |
      | yeast      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |

  Scenario Outline: Labels point at what they name
    Given the <type> cell type
    When its labels are listed
    Then there are at least three labels
    And every label anchor lies inside the cell
    And every label with a material sits inside that material

    Examples:
      | type       |
      | yeast      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |

  Scenario Outline: Every cell type comes to rest on the floor
    Given the <type> cell type
    When it is dropped on the floor and left for two seconds
    Then no particle is below the floor
    And its volume is within 3 percent of rest

    Examples:
      | type       |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |

  Scenario: A red blood cell has no nucleus and a dimple
    Given the rbc cell type
    When its anatomy is built
    Then it has no nucleus, nucleolus or mitochondria
    And it is thinner at its centre than at its rim

  Scenario: A fibroblast lies flat and spread
    Given the fibroblast cell type
    When its anatomy is built
    Then it is less than a third as tall as it is long
    And it has stress fibres ending in focal adhesions

  Scenario: A neuron reaches far beyond its soma
    Given the neuron cell type
    When its anatomy is built
    Then it is more than three soma diameters long
    And it has Nissl bodies and a nucleolus

  Scenario: Microglia are ramified
    Given the microglia cell type
    When its anatomy is built
    Then at least four processes leave the soma
    And it has lysosomes
