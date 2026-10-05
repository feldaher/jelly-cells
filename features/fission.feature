Feature: A cell that finishes its cycle becomes two cells
  The last stage of a dividing cell carries a fission plane. When the morph arrives
  there, the world splits the cell along it into two soft bodies.

  Scenario Outline: Playing the cycle to the end divides the cell
    Given a world with the <type> cell one stage before its last
    When it is morphed to the last stage and simulated until the morph ends
    Then there are two pieces
    And the smaller piece holds at least <share> percent of the volume
    And every particle is finite and above the floor
    And the daughters do not overlap

    Examples:
      | type  | share |
      | pombe | 40    |
      | ecoli | 40    |
      | yeast | 15    |

  Scenario: Only the stage that carries a fission plane divides
    Given a world with the pombe cell at its septation stage
    When it is asked to divide
    Then it refuses and stays one piece

  Scenario: A divided cell is made whole when the stage changes
    Given a world with the pombe cell divided in two
    When it is morphed to the first stage
    Then the world is at the first stage with one piece at once
