Feature: Jelly Cells on the Academia Classy design system
  The page takes its colours, type, spacing and radii from the design system's tokens
  (src/tokens.css, copied verbatim from the system). The canvas must match the page around it.

  Scenario: The tokens are the design system's own file
    Then src/tokens.css is the Academia Classy tokens file

  Scenario: Only the design system's fonts are used
    Then the page and its styles name no font family outside the design system's three

  Scenario: Each microscope view sits on a design-system background
    Then brightfield and EM use light-theme colours and fluorescence uses dark-theme colours
