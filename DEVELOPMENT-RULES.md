# Development Rules

**CRITICAL RULES - MUST BE ENFORCED**

## 📋 Rule #1: README.md is MANDATORY for Every Mini Project

### Rule Statement
**Every mini project folder MUST have a README.md file with complete context.**

### Why This Rule Exists
- **Context Preservation**: Future work can continue without prior conversation history
- **Self-Documentation**: Each project is self-contained and understandable
- **Onboarding**: New developers can understand the project immediately
- **Maintenance**: Easy to maintain and update without losing context

### What Qualifies as a "Mini Project"
- Any folder containing code files (HTML, CSS, JS)
- Examples: `notes/`, `tasks/`, `secret/`, `translate/`, `encoder/`, `backup/`, `modals/`
- Exception: Root-level files (index.html, hub.html, config.js, common.css) documented in root README.md

### README.md Must Include

#### 1. Overview Section
```markdown
## 📋 Overview
Brief description of what this project/modal does and its purpose.
```

#### 2. Features Section
```markdown
## 🚀 Features
Complete list of all features with brief descriptions.
```

#### 3. File Structure Section
```markdown
## 📁 File Structure
List all files in the folder with their purposes.
```

#### 4. Technical Implementation Section
```markdown
## 🔧 Technical Implementation
- Key functions with code examples
- State management
- Important algorithms
- Data flow
```

#### 5. Database Schema (if applicable)
```markdown
## 🗄️ Database Schema
Complete schema with field descriptions and examples.
```

#### 6. Styling Section
```markdown
## 🎨 Styling
- Key CSS classes
- Layout description
- Visual examples
```

#### 7. Dependencies Section
```markdown
## 🔌 Dependencies
- External dependencies
- Internal dependencies
- Integration points
```

#### 8. Usage Section
```markdown
## 🚀 Usage
Step-by-step usage instructions with examples.
```

#### 9. Configuration Section
```markdown
## ⚙️ Configuration
How to configure and customize the project.
```

#### 10. Troubleshooting Section
```markdown
## 🐛 Troubleshooting
Common issues and solutions.
```

#### 11. Development Notes Section
```markdown
## 📝 Development Notes
- How to add new features
- Code style guidelines
- Performance considerations
```

#### 12. Related Documentation Section
```markdown
## 🔗 Related Documentation
Links to other relevant documentation.
```

### README.md Quality Checklist

Before considering a README.md complete, verify:

- [ ] **Complete Context**: Can someone read this README and understand the entire project without any prior knowledge?
- [ ] **Code Examples**: Are there actual code snippets showing how things work?
- [ ] **No Assumptions**: Does it assume any prior knowledge that isn't documented?
- [ ] **Troubleshooting**: Are common issues documented with solutions?
- [ ] **Up-to-date**: Does it reflect the current state of the code?
- [ ] **Self-contained**: Can this README stand alone without referencing other docs for basic understanding?
- [ ] **Technical Details**: Are implementation details explained, not just features?
- [ ] **Why, not just What**: Does it explain WHY decisions were made, not just WHAT was implemented?

### Examples of GOOD README.md

**Good Example (notes/README.md):**
```markdown
# Notes App

## 📋 Overview
A rich text note-taking application with advanced editing features...

## 🔧 Technical Implementation

### Rich Text Protection
```javascript
function detectRichTextContent(note) {
    const richTextTags = /<(strong|em|u|b|i|ul|ol|li|code|pre|h[1-6]|span|p)[^>]*>/i;
    const hasRichText = richTextTags.test(note.content);
    
    if (hasRichText) {
        textarea.readOnly = true;
        warning.style.display = 'block';
    }
}
```

**Why this approach:**
- Prevents accidental loss of rich text formatting
- User must use rich text editor to edit formatted content
- Plain textarea would convert HTML to plain text on save
```

### Examples of BAD README.md

**Bad Example:**
```markdown
# Notes App

This is a notes app. It has rich text editing.

## Usage
1. Create note
2. Edit note
3. Save note
```

**Why this is bad:**
- No technical details
- No code examples
- No explanation of HOW things work
- No troubleshooting
- Cannot continue development from this

## 🚨 Enforcement

### When Creating New Mini Project

**BEFORE writing any code:**
1. Create folder: `project-name/`
2. Create `README.md` with template
3. Fill in Overview and Features sections
4. THEN start coding

**AFTER completing code:**
1. Update README.md with:
   - Technical Implementation (with code examples)
   - Database Schema (if applicable)
   - Troubleshooting
   - Development Notes
2. Verify README.md Quality Checklist
3. ONLY THEN consider project complete

### When Modifying Existing Mini Project

**BEFORE making changes:**
1. Read existing README.md
2. Understand current implementation

**AFTER making changes:**
1. Update README.md to reflect changes
2. Add new code examples if needed
3. Update troubleshooting if new issues found
4. Verify README.md still passes Quality Checklist

### Code Review Checklist

When reviewing code (or AI reviewing its own work):
- [ ] Does the mini project folder have README.md?
- [ ] Does README.md pass the Quality Checklist?
- [ ] Are all new features documented?
- [ ] Are all code examples up-to-date?
- [ ] Can someone continue development from this README alone?

## 📝 README.md Template

Use this template for new mini projects:

```markdown
# [Project Name]

[One-line description]

## 📋 Overview

[Detailed description of what this project does and why it exists]

## 🚀 Features

- **Feature 1**: Description
- **Feature 2**: Description

## 📁 File Structure

```
folder/
├── file1.js        # Description
├── file2.css       # Description
└── README.md       # This file
```

## 🔧 Technical Implementation

### [Key Feature 1]

**[Explanation]:**
```javascript
// Code example
function example() {
    // Implementation
}
```

**Why this approach:**
- Reason 1
- Reason 2

### [Key Feature 2]

[Continue pattern...]

## 🗄️ Database Schema (if applicable)

```json
{
  "field1": "type (description)",
  "field2": "type (description)"
}
```

## 🎨 Styling

### Key CSS Classes
- `.class-name`: Description

### Layout
```
[ASCII art or description of layout]
```

## 🔌 Dependencies

### External
- `dependency1`: Purpose

### Internal
- `file1`: Purpose

### Integration
- How this integrates with other parts

## 🚀 Usage

### [Use Case 1]
1. Step 1
2. Step 2

### [Use Case 2]
[Continue pattern...]

## ⚙️ Configuration

### [Config Option 1]
```javascript
// How to configure
```

## 🐛 Troubleshooting

### [Issue 1]
- **Problem**: Description
- **Solution**: How to fix
- **Why**: Explanation

## 📝 Development Notes

### Adding New Features
[How to add features]

### Code Style
[Code style guidelines]

### Performance
[Performance considerations]

## 🔗 Related Documentation

- [Link 1]: Description
- [Link 2]: Description

## 📞 Support

For issues or questions:
1. Check this README first
2. Check related documentation
3. Check Console for errors

---

**Version**: X.X.X  
**Last Updated**: YYYY-MM-DD  
**Part of**: BiBo Project  
**Tech Stack**: [Technologies used]
```

## 🎯 Success Criteria

A README.md is considered complete when:

1. **Standalone Test**: Someone with no prior knowledge can:
   - Understand what the project does
   - Understand how it works (technically)
   - Make modifications to the code
   - Troubleshoot common issues
   - Add new features

2. **Context Preservation Test**: After 6 months:
   - Original developer can continue work
   - New developer can take over
   - No conversation history needed

3. **Technical Depth Test**: README includes:
   - Actual code examples (not just descriptions)
   - Explanation of WHY, not just WHAT
   - Implementation details
   - Edge cases and gotchas

## 🔄 Maintenance

### When to Update README.md

**MUST update when:**
- Adding new features
- Changing existing functionality
- Fixing bugs (add to troubleshooting)
- Refactoring code
- Changing dependencies
- Updating configuration

**SHOULD update when:**
- Discovering new edge cases
- Finding better ways to explain things
- Getting questions from users/developers

### README.md Review Schedule

- **After every feature**: Update immediately
- **Monthly**: Review for accuracy
- **Before release**: Comprehensive review

## 🚫 What NOT to Do

### Don't:
- ❌ Write README after project is "done" (write as you code)
- ❌ Copy-paste from other READMEs without customizing
- ❌ Use vague descriptions ("it works well", "easy to use")
- ❌ Skip code examples ("see code for details")
- ❌ Assume prior knowledge
- ❌ Write TODO sections and leave them
- ❌ Document features that don't exist yet

### Do:
- ✅ Write README alongside code
- ✅ Use specific, concrete descriptions
- ✅ Include actual code examples
- ✅ Explain WHY decisions were made
- ✅ Document current state only
- ✅ Update immediately when code changes
- ✅ Test README by having someone else read it

## 📊 Metrics

Track README.md quality:
- **Completeness**: All sections filled?
- **Code Examples**: At least 3 code examples?
- **Troubleshooting**: At least 3 common issues documented?
- **Length**: At least 200 lines? (Good READMEs are detailed)
- **Last Updated**: Within last month?

## 🎓 Learning Resources

Good README examples in this project:
- `notes/README.md` - Comprehensive with code examples
- `tasks/README.md` - Good technical depth
- `secret/README.md` - Good security documentation

External resources:
- [Make a README](https://www.makeareadme.com/)
- [Awesome README](https://github.com/matiassingers/awesome-readme)
- [Art of README](https://github.com/hackergrrl/art-of-readme)

---

**This rule is MANDATORY and MUST be enforced for all mini projects.**

**Violation of this rule means the project is INCOMPLETE.**

**No exceptions.**
