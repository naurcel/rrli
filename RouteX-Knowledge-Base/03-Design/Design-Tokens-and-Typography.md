# Design Tokens and Typography

- Typeface: Readex Pro is specified in the working design guidance; confirm font licensing and actual asset inclusion in the implementation.
- Theme: light theme with optional dark mode/system theme as a prototype/working requirement; exact preference persistence TBD.
- Layout: spacious, readable, table-first where users need to find and compare records.
- Components: use the existing custom shared components and Tailwind 4 styles
  consistently. Do not introduce shadcn/ui without an approved dependency decision.
- Icons: use the existing hand-authored icon system; Lucide React is not installed.
- Radius/spacing: generous rounded corners and consistent spacing are part of the design direction, but exact token values must be read from the current canonical design source before implementation.

Do not invent numeric design tokens. If values are not present in the source package, record them as TBD and define them in a reviewed token sheet.
