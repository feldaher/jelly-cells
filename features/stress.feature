Feature: The stress lab
  Salt is added to a budding yeast's medium. The cell shrinks, the kinase Hog1 moves into
  the nucleus, and the stronger the shock the later that signal peaks
  (Babazadeh et al. 2013, PLoS One 8:e80901).

  Scenario Outline: Nuclear Hog1 peaks when it was measured to
    Given a yeast cell put in <nacl> M NaCl
    When its response is followed for 60 minutes
    Then nuclear Hog1 is highest at <peak> minutes

    Examples:
      | nacl | peak |
      | 0.1  | 3    |
      | 0.4  | 5    |
      | 0.6  | 6    |
      | 0.8  | 15   |
      | 1.0  | 25   |

  Scenario Outline: The cell loses the volume that was measured
    Given a yeast cell put in <nacl> M NaCl
    When its response is followed for 60 minutes
    Then its lowest volume is <volume> percent of the unstressed cell

    Examples:
      | nacl | volume |
      | 0.4  | 70     |
      | 0.8  | 45     |

  Scenario: A mild shock is recovered from
    Given a yeast cell put in 0.4 M NaCl
    When 45 minutes have passed
    Then it has regained at least 90 percent of the volume it lost

  Scenario: A severe shock is hardly recovered from
    Given a yeast cell put in 0.8 M NaCl
    When 45 minutes have passed
    Then it has regained 10 percent of the volume it lost

  Scenario: Hog1 adapts perfectly after a mild shock
    Given a yeast cell put in 0.1 M NaCl
    When 45 minutes have passed
    Then nuclear Hog1 is back within 2 percent of its unstressed level

  Scenario: A weak shock gives a weaker signal than a saturating one
    Given a yeast cell put in 0.1 M NaCl
    When its response is followed for 60 minutes
    Then its highest nuclear Hog1 is below that of a cell in 0.4 M NaCl

  Scenario: Without salt nothing happens
    Given a yeast cell put in 0 M NaCl
    When its response is followed for 60 minutes
    Then its volume stays at 100 percent and nuclear Hog1 at zero

  Scenario: The soft body shrinks to the volume it is given
    Given a yeast cell resting on the floor
    When its rest volume is set to 70 percent and it settles
    Then its measured volume is within 3 percent of 70 percent
    And it shows no deformation

  Scenario: A cut through a shrunken cell lands where it is drawn
    Given a rest shape shrunk to 45 percent of its volume, turned and moved
    When a world plane is carried into rest space
    Then every rest point on that plane sits on the world plane

  Scenario: A run records the lowest volume and the time of the peak
    Given a run in 0.8 M NaCl
    When the response is sampled every tenth of a minute for 30 minutes
    Then the run's lowest volume is 45 percent
    And its peak is at 15 minutes
    And the peak was not reported before it had passed

  Scenario: The Hog1 view lights the nucleus with the signal
    Given the Hog1 view of an unstressed cell
    Then the nucleus is as bright as the cytoplasm
    Given the Hog1 view at the largest response
    Then the nucleus is brighter than the cytoplasm

  Scenario: Starting a stress starts the clock
    Given a yeast cell in the world
    When 0.4 M NaCl is added and one second passes
    Then about one cell minute has passed
    And the cell has started to shrink
    And it weighs less by the water it lost

  Scenario: Only cells with a measured response have a stress lab
    Then budding yeast has a salt response with the five measured doses
    And budding yeast has a heat response at 42 and 46 degrees
    And no other cell has a stress lab
