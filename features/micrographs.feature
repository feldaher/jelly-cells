Feature: Real micrographs on the label cards
  Every label card shows a real electron, fluorescence or light micrograph of the
  structure, from Wikimedia Commons, with its author and licence.

  Scenario Outline: Every label has a credited micrograph
    Given the <cell> cell type
    When its labels are listed at every stage
    Then each label has a micrograph
    And each micrograph is public domain, CC0, CC BY or CC BY-SA with an author
    And each micrograph file is in the site's public folder
    And each micrograph names its Commons file and says what it shows

    Examples:
      | cell       |
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

  Scenario: The physics notes open in a modal
    Given the page markup
    Then the physics notes are in a dialog with a close button
    And a button opens them
    And they state the XPBD update and the Green–Lagrange strain
