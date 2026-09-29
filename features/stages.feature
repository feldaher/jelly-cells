Feature: Every cell has a life to step through
  Each cell type offers a stage slider: microglia activate, a neuron responds
  to axotomy, a red cell crenates into a sphere, a fibroblast heals a wound.

  Scenario Outline: Every stage of every cell is a sound soft body with honest labels
    Given the <type> cell at stage <stage>
    When its simulation mesh is built
    Then every tetrahedron has a positive rest volume
    And the tetrahedra form a single connected component
    And the particle count stays within the real-time budget
    And every label anchor lies inside the cell
    And every label with a material sits inside that material

    Examples:
      | type       | stage |
      | microglia  | 0     |
      | microglia  | 1     |
      | microglia  | 2     |
      | microglia  | 3     |
      | neuron     | 0     |
      | neuron     | 1     |
      | neuron     | 2     |
      | neuron     | 3     |
      | rbc        | 0     |
      | rbc        | 1     |
      | rbc        | 2     |
      | rbc        | 3     |
      | fibroblast | 0     |
      | fibroblast | 1     |
      | fibroblast | 2     |
      | fibroblast | 3     |

  Scenario: Activated microglia pull in their processes and fill with lysosomes
    Given the microglia cell at its first and last stages
    When their anatomies are compared
    Then the amoeboid cell reaches less far from its soma
    And it has more lysosomes

  Scenario: An injured neuron loses its distal axon, then regrows it
    Given the neuron cell at every stage
    When the reach of its axon is measured
    Then the axon is shorter after axotomy than when healthy
    And the regenerating axon reaches further than the stump
    And the regenerating axon ends in a growth cone

  Scenario: Chromatolysis moves the nucleus aside and disperses the Nissl bodies
    Given the neuron cell at stages 0 and 2
    When their somata are compared
    Then the nucleus sits further from the soma centre
    And there are fewer Nissl bodies

  Scenario: A red cell keeps its volume as it rounds up
    Given the rbc cell at every stage
    When the cell volumes and centre thicknesses are measured
    Then every volume is within 15 percent of the discocyte's
    And the centre gets thicker at every stage

  Scenario: A spreading fibroblast flattens, a myofibroblast pulls harder
    Given the fibroblast cell at every stage
    When the shapes and fibres are compared
    Then the rounded cell is the tallest for its width
    And the myofibroblast has more stress fibres than the migrating cell
