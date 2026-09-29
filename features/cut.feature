Feature: Cutting the cell open
  A vertical blade plane is carried into each piece's rest space and splits it
  into two fresh soft bodies.

  Scenario: A cut through the mother makes two pieces
    Given an intact cell resting on the floor
    When a blade passes through the middle of the mother
    Then there are two pieces
    And their rest volumes add up to the intact volume within 4 percent

  Scenario: A cut through the neck frees the bud
    Given an intact cell resting on the floor
    When a blade passes through the neck
    Then one piece contains the bud centre and the other the mother centre

  Scenario: A blade that misses leaves the cell alone
    Given an intact cell resting on the floor
    When a blade passes beside the cell
    Then there is one piece

  Scenario: Cutting conserves momentum
    Given an intact cell sliding across the floor
    When a blade passes through the middle of the mother
    Then the total linear momentum is unchanged within 3 percent

  Scenario: Knife faces are flat and flagged
    Given an intact cell resting on the floor
    When a blade passes through the middle of the mother
    Then each piece has flagged cut-face vertices lying on its cut plane at rest

  Scenario: A piece can be cut again
    Given an intact cell resting on the floor
    When a blade passes through the middle of the mother
    And a second blade crosses the first
    Then there are more than two pieces
