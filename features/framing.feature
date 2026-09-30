Feature: Framing the cell around the page's controls
  On small screens the controls, title and readout cover part of the canvas.
  The camera frames the cell in the part left free, and labels stay inside it.
  Wide screens keep their usual framing.

  Scenario: A control sheet along the bottom pushes the cell up
    Given a 390 by 844 phone screen with a readout across the top and a control sheet along the bottom
    When the free area and the framing are worked out
    Then the free area lies between the readout and the sheet
    And the camera target lands in the middle of the free area
    And the cell is pulled back far enough to fit the screen's width

  Scenario: An open sheet taller than half the screen still pushes the cell up
    Given a 390 by 844 phone screen with a readout across the top and an open sheet covering the lower 60 percent
    When the free area and the framing are worked out
    Then the free area lies between the readout and the sheet
    And the camera target lands in the middle of the free area

  Scenario: A control column on the right pushes the cell left
    Given an 844 by 390 phone screen with a control column on the right
    When the free area and the framing are worked out
    Then the free area ends where the column starts
    And the camera target lands in the middle of the free area

  Scenario: A wide screen with nothing in the way is framed as before
    Given a 1600 by 1000 screen with nothing in the way
    When the free area and the framing are worked out
    Then the lens is not shifted
    And the camera is not pulled back
