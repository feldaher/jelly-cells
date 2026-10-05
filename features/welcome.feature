Feature: A welcome screen
  A first-time visitor is told in a few lines what this is and what they can do,
  and one button takes them to the cell. It does not come back unless asked for.

  Scenario: The welcome says what this is and what you can do
    Given the page markup
    Then the welcome is a dialog with a title and a start button
    And it names every cell in the dropdown
    And it tells the visitor they can grab, cut, play and read labels
    And it is short: under 120 words
    And a button on the page opens it again

  Scenario: The welcome shows once
    Given a visitor who has never been here
    When the page decides whether to welcome them
    Then it does
    And after they start, it does not welcome them again

  Scenario: A browser that refuses storage still gets a welcome
    Given a browser whose storage throws
    When the page decides whether to welcome them
    Then it does
    And starting does not fail
