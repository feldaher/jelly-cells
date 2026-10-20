Feature: Heat shock and condensates
  A budding yeast is moved from 30 °C to a higher temperature. At 42 °C the poly(A)-binding
  protein Pab1 assembles into particles a centrifuge can pellet but a microscope cannot see.
  At 46 °C it gathers into stress granules, visible as foci, within minutes
  (Wallace et al. 2015, Cell 162:1286; Riback et al. 2017, Cell 168:1028).

  Scenario: At the growth temperature nothing assembles
    Given a yeast cell kept at 30 degrees
    When 30 minutes have passed
    Then no Pab1 has assembled and there are no foci

  Scenario: At 46 degrees Pab1 is still mostly soluble after two minutes
    Given a yeast cell moved to 46 degrees
    When 2 minutes have passed
    Then less than a quarter of the largest response has assembled

  Scenario: At 46 degrees most Pab1 has assembled after eight minutes, in visible foci
    Given a yeast cell moved to 46 degrees
    When 8 minutes have passed
    Then the assembly is at its largest
    And the foci are fully formed

  Scenario: At 42 degrees Pab1 assembles without visible foci
    Given a yeast cell moved to 42 degrees
    When 10 minutes have passed
    Then assembled Pab1 is detectable
    And there are no foci
    And even after 30 minutes there are no foci and less has assembled than at 46 degrees

  Scenario: Heat does not change the cell's volume here
    Given a yeast cell moved to 46 degrees
    When 8 minutes have passed
    Then its volume is that of the unstressed cell

  Scenario Outline: The yeast carries condensates in its cytoplasm at every stage
    Given the yeast anatomy at stage <stage>
    Then it has at least six condensates
    And each lies in the cytoplasm, clear of the wall and of every other organelle
    And each is about a quarter of a micrometre across

    Examples:
      | stage |
      | 0     |
      | 1     |
      | 2     |
      | 3     |
      | 4     |
      | 5     |

  Scenario: Condensates are not there until the heat has formed them
    Given a yeast cell in the world
    Then its condensates are hidden
    When it is moved to 42 degrees for 30 cell minutes
    Then its condensates are still hidden
    When it is moved to 46 degrees for 8 cell minutes
    Then its condensates are shown

  Scenario: A cut through an unstressed cell reports no condensates
    Given a section report that crossed a condensate
    When the cell has formed no foci
    Then the report lists no condensate
    When the cell has formed foci
    Then the report lists the condensate

  Scenario: The Pab1 view shows foci brighter than the cytoplasm
    Given the Pab1 view of an unstressed cell
    Then the condensates are no brighter than the cytoplasm
    And the nucleus is dimmer than the cytoplasm
    Given the Pab1 view after 8 minutes at 46 degrees
    Then the condensates are much brighter than the cytoplasm
    And the cytoplasm is dimmer than before

  Scenario: A heat run records whether foci were seen
    Given a run at 42 degrees followed for 30 minutes
    Then it saw no foci but some assembled Pab1
    Given a run at 46 degrees followed for 10 minutes
    Then it saw foci and the largest assembly

  Scenario: Back at 30 degrees the assemblies dissolve within the hour
    Given a yeast cell that has spent 8 minutes at 46 degrees
    When it is returned to 30 degrees
    Then at first everything is as it was at 46 degrees
    And after 20 minutes it has partly dissolved
    And after 60 minutes nothing is assembled and the foci are gone

  Scenario: Assemblies made at 42 degrees dissolve too
    Given a yeast cell that has spent 30 minutes at 42 degrees
    When it is returned to 30 degrees
    Then after 60 minutes nothing is assembled

  Scenario: Heating a cell that is already assembling carries on from where it was
    Given a yeast cell that has spent 30 minutes at 42 degrees
    When it is moved on to 46 degrees
    Then its assembled Pab1 never drops and reaches the largest response
    And foci form

  Scenario: Cooling from 46 to 42 degrees keeps what has formed
    Given a yeast cell that has spent 8 minutes at 46 degrees
    When it is moved to 42 degrees for 10 minutes
    Then its assembled Pab1 and its foci are unchanged

  Scenario: The world carries the cell's state into recovery
    Given a yeast cell in the world, 8 cell minutes at 46 degrees
    When it is returned to 30 degrees for 20 cell minutes
    Then its condensates are still shown and partly dissolved
    When 45 more cell minutes pass
    Then its condensates are hidden again

  Scenario: The stress granules have a label and a key entry
    Given the yeast cell type
    Then its labels at every stage include a stress granule anchored on a condensate
    And its key lists stress granules

  Scenario: A run keeps a trace for the graph
    Given a run at 46 degrees sampled every tenth of a minute for 8 minutes
    When it carries on through 20 minutes of recovery
    Then its trace runs from 0 to 28 minutes without a gap
    And it marks the change at 8 minutes
    And the trace's foci line is drawn left to right, rising then falling
