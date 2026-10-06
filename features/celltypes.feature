Feature: A gallery of cell types
  Every specimen in the dropdown (cells, a fungal hypha and two viruses) is a sound
  soft body with its own anatomy, and its teaching labels point at what they name.

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
      | pombe      |
      | ecoli      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |
      | animal     |
      | plant      |
      | aspergillus|
      | phage      |
      | coronavirus|

  Scenario Outline: Labels point at what they name
    Given the <type> cell type
    When its labels are listed
    Then there are at least three labels
    And every label anchor lies inside the cell
    And every label with a material sits inside that material

    Examples:
      | type       |
      | yeast      |
      | pombe      |
      | ecoli      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |
      | animal     |
      | plant      |
      | aspergillus|
      | phage      |
      | coronavirus|

  Scenario Outline: Every cell type comes to rest on the floor
    Given the <type> cell type
    When it is dropped on the floor and left for two seconds
    Then no particle is below the floor
    And its volume is within 3 percent of rest

    Examples:
      | type       |
      | pombe      |
      | ecoli      |
      | rbc        |
      | fibroblast |
      | microglia  |
      | neuron     |
      | animal     |
      | plant      |
      | aspergillus|
      | phage      |
      | coronavirus|

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

  Scenario: An animal cell has the textbook organelles and no wall
    Given the animal cell type
    When its anatomy is built
    Then it has a nucleus with a nucleolus, rough ER, a Golgi stack, a centrosome, mitochondria, lysosomes and peroxisomes
    And it has no chloroplast and no vacuole
    And it is about 20 micrometres across
    And its membrane is far thinner than a plant cell's wall

  Scenario: A plant cell is a walled column lined with chloroplasts around a vacuole
    Given the plant cell type
    When its anatomy is built
    Then it is more than twice as long as it is wide
    And it has at least 30 chloroplasts, each 5 micrometres across and lying flat between the vacuole and the wall
    And its central vacuole takes up more than half of the cell, with the nucleus pressed flat against the wall
    And it has a nucleus, mitochondria, peroxisomes, Golgi stacks and rough ER

  Scenario: Bacteriophage T4 has the measured head, tail and fibres
    Given the phage cell type
    When its anatomy is built
    Then its head is 115 nm long and 85 nm wide
    And its tail is 92.5 nm long and 24 nm wide, with a tube 9 nm wide inside
    And it has a baseplate 52 nm across and six long tail fibres of 145 nm
    And its DNA lies inside the head

  Scenario: A coronavirus is an enveloped sphere with spikes
    Given the coronavirus cell type
    When its anatomy is built
    Then its envelope is about 100 nm across
    And 24 spikes stand out from it
    And its RNA, packed in beads, lies inside the envelope

  Scenario: An Aspergillus hypha is a tube with many nuclei and a pierced septum
    Given the aspergillus cell type
    When its anatomy is built
    Then it is 3 micrometres wide and more than five times as long
    And its septum has a central pore with Woronin bodies beside it
    And the tip compartment holds one nucleus for about every 60 cubic micrometres of cytoplasm
    And a Spitzenkörper sits at the very tip
    And its Golgi is single rings, more of them toward the tip but none in the dome, and microtubules run its length

  Scenario: Budding yeast has ER against its membrane and a Golgi that is not stacked
    Given the yeast cell type
    When its anatomy is built
    Then its ER sheets lie within 0.4 micrometres of the cell wall
    And its Golgi cisternae are single, no two in a stack

  Scenario: A neuron's Golgi wraps its nucleus and sends an outpost into a dendrite
    Given the neuron cell type
    When its anatomy is built
    Then most of its Golgi cisternae are curved about the nucleus
    And a few sit in the main dendrite, far from the soma
    And microtubules run along the axon

  Scenario Outline: Microtubules radiate from the centrosome
    Given the <type> cell type
    When its anatomy is built
    Then at least eight microtubules start at the centrosome and none passes through the nucleus

    Examples:
      | type       |
      | fibroblast |
      | animal     |
