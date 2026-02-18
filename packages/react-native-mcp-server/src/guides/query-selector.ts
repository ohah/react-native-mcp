export const querySelectorGuide = {
  name: 'query-selector-syntax',
  description:
    'query_selector / query_selector_all selector syntax reference. Type, testID, text, attribute, hierarchy, capability selectors and workflow examples.',
  content: `# query_selector / query_selector_all

Selector syntax for finding elements in the React Native Fiber tree. Similar to CSS \`querySelector\` but for the **React Fiber tree**, not DOM.

## Basic syntax

### Type selector

Match by component type name:

\`\`\`
View
Text
ScrollView
Pressable
FlatList
TextInput
\`\`\`

### testID selector

\`#\` for testID:

\`\`\`
#login-btn
#email-input
#product-list
\`\`\`

Combine with type:

\`\`\`
Pressable#login-btn
TextInput#email-input
\`\`\`

### Text selector

\`:text("...")\` — **substring match** on subtree text:

\`\`\`
:text("Login")
:text("Submit")
Text:text("Welcome")
Pressable:text("OK")
\`\`\`

> Text is concatenated from all children. E.g. \`<View><Text>Hello</Text><Text>World</Text></View>\` matches \`:text("Hello World")\`.

### Attribute selector

\`[attr="value"]\` — match by props:

\`\`\`
[accessibilityLabel="Close"]
[placeholder="Email"]
View[accessibilityRole="button"]
\`\`\`

### displayName selector

\`:display-name("...")\` — match by \`fiber.type.displayName\` (independent of type name):

\`\`\`
:display-name("Animated.View")   # Reanimated: type is AnimatedComponent, displayName matches Animated.View
View:display-name("CustomBox")
\`\`\`

### Index selectors

\`:first-of-type\` — first match (same as \`:nth-of-type(1)\`). \`:last-of-type\` — last match:

\`\`\`
Pressable:first-of-type      # first Pressable
Pressable:last-of-type       # last Pressable
View:text("Bottom sheet"):last-of-type   # last View containing "Bottom sheet"
\`\`\`

\`:nth-of-type(N)\` — Nth match (1-based):

\`\`\`
Text:nth-of-type(1)          # first Text (= :first-of-type)
Pressable:nth-of-type(3)     # third Pressable
:text("Item"):nth-of-type(2) # second element containing "Item"
\`\`\`

### Capability selectors

\`:has-press\` — element has \`onPress\` handler:

\`\`\`
:has-press                    # all pressable elements
View:has-press                # View with onPress
:has-press:text("Delete")     # pressable with "Delete" text
\`\`\`

\`:has-scroll\` — element has \`scrollTo\` or \`scrollToOffset\`:

\`\`\`
:has-scroll                   # all scrollable elements
ScrollView:has-scroll         # scrollable ScrollView
\`\`\`

## Hierarchy selectors

### Direct child (\`>\`)

\`\`\`
View > Text              # Text that is direct child of View
ScrollView > View > Text # 3-level hierarchy
\`\`\`

### Descendant (space)

\`\`\`
View Text                # Text anywhere under View
ScrollView Pressable     # any Pressable under ScrollView
\`\`\`

### Combined example

\`\`\`
View > ScrollView:has-scroll > Pressable:text("Add")
\`\`\`

## OR (comma)

Combine multiple selectors with comma:

\`\`\`
ScrollView, FlatList           # ScrollView or FlatList
Pressable, TouchableOpacity    # either type
#btn-a, #btn-b                 # either testID
\`\`\`

## Compound examples

\`\`\`
# Find login button
Pressable:text("Login")

# TextInput by testID
TextInput#email-input

# Close button by accessibility label
[accessibilityLabel="Close"]:has-press

# Third pressable inside ScrollView
ScrollView :has-press:nth-of-type(3)

# FlatList or ScrollView
FlatList, ScrollView

# All Text inside a specific View
View#header > Text
\`\`\`

## Return value

### query_selector (single)

\`\`\`json
{
  "uid": "login-btn",
  "type": "Pressable",
  "testID": "login-btn",
  "text": "Login",
  "accessibilityLabel": null,
  "hasOnPress": true,
  "hasOnLongPress": false,
  "hasScrollTo": false,
  "measure": {
    "x": 100, "y": 200,
    "width": 150, "height": 44,
    "pageX": 100, "pageY": 200
  }
}
\`\`\`

- \`uid\` — testID when present, otherwise path string (e.g. \`"0.1.2"\`)
- \`measure\` — element coordinates and size (points). pageX/pageY are absolute from top-left of screen.
- If \`measure\` is null, use \`evaluate_script(measureView(uid))\` to get it (rare).

### query_selector_all (multiple)

\`\`\`json
[
  { "uid": "item-0", "type": "Pressable", "text": "Item 1", "hasOnPress": true, "measure": { ... } },
  { "uid": "item-1", "type": "Pressable", "text": "Item 2", "hasOnPress": true, "measure": { ... } }
]
\`\`\`

## Workflow

### Find element → native tap (2 steps)

\`\`\`
1. query_selector('Pressable:text("Login")') → get uid + measure
2. tap(platform, measure.pageX + measure.width/2, measure.pageY + measure.height/2) → tap center
\`\`\`

> measure is included in the result, so a separate measureView call is not needed.

### Assert text

\`\`\`
assert_text("Welcome") → { pass: true }
\`\`\`

### List all pressable elements

\`\`\`
query_selector_all(':has-press')
\`\`\`

### All text nodes

\`\`\`
query_selector_all('Text')
\`\`\`

## Syntax summary

| Syntax | Description | Example |
|---|---|---|
| \`Type\` | Component type | \`View\`, \`Text\`, \`Pressable\` |
| \`#id\` | testID | \`#login-btn\` |
| \`[attr="val"]\` | Props attribute | \`[accessibilityLabel="Close"]\` |
| \`:text("...")\` | Text substring match | \`:text("Login")\` |
| \`:display-name("...")\` | fiber.type.displayName match | \`:display-name("Animated.View")\` |
| \`:first-of-type\` | First match | \`Pressable:first-of-type\` |
| \`:last-of-type\` | Last match | \`View:text("Bottom sheet"):last-of-type\` |
| \`:nth-of-type(N)\` | Nth match (1-based) | \`:nth-of-type(1)\` |
| \`:has-press\` | Has onPress | \`:has-press\` |
| \`:has-scroll\` | Has scrollTo | \`:has-scroll\` |
| \`A > B\` | Direct child | \`View > Text\` |
| \`A B\` | Descendant | \`View Text\` |
| \`A, B\` | OR | \`ScrollView, FlatList\` |
`,
};
