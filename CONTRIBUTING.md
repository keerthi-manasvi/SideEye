# Contributing to SideEye Workspace

Thank you for your interest in contributing to SideEye Workspace! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Python 3.7+
- Git
- Basic knowledge of Electron, React, and Django

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/YOUR_USERNAME/sideeye-workspace-app.git
   cd sideeye-workspace-app
   ```

2. **Install Dependencies**

   ```bash
   npm install
   npm run postinstall
   ```

3. **First Run Setup**

   ```bash
   npm run first-run-setup
   ```

4. **Start Development Environment**
   ```bash
   npm run dev
   ```

## Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

- **Bug Fixes**: Fix issues and improve stability
- **Features**: Add new functionality
- **Documentation**: Improve guides, API docs, and code comments
- **Testing**: Add tests and improve test coverage
- **Performance**: Optimize code and improve efficiency
- **Accessibility**: Improve accessibility and usability
- **Translations**: Help translate the interface

### Before You Start

1. **Check Existing Issues**: Look for existing issues or discussions
2. **Create an Issue**: For new features or major changes, create an issue first
3. **Discuss**: Engage with maintainers and community before starting work
4. **Small Changes**: For small bug fixes, you can directly create a PR

### Coding Standards

#### JavaScript/React

- Use ES6+ features and modern JavaScript
- Follow React best practices and hooks patterns
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Use TypeScript where beneficial

#### Python/Django

- Follow PEP 8 style guidelines
- Use Django best practices
- Write docstrings for functions and classes
- Use type hints where appropriate
- Follow Django REST framework conventions

#### General

- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Use consistent naming conventions
- Follow existing code patterns

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(emotion): add confidence threshold setting
fix(camera): resolve initialization timeout on Linux
docs(api): update endpoint documentation
test(tasks): add integration tests for task sorting
```

## Pull Request Process

### Before Submitting

1. **Update Documentation**: Update relevant documentation
2. **Add Tests**: Include tests for new functionality
3. **Test Thoroughly**: Test on multiple platforms if possible
4. **Check Code Style**: Ensure code follows project standards
5. **Update Changelog**: Add entry to CHANGELOG.md if applicable

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages follow conventional format

### PR Template

When creating a PR, include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Other (specify)

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Cross-platform testing (if applicable)

## Screenshots/Videos

(If applicable)

## Additional Notes

Any additional context or notes
```

## Issue Reporting

### Bug Reports

Include the following information:

```markdown
## Bug Description

Clear description of the bug

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- OS: [e.g., Windows 10, macOS 12.0, Ubuntu 20.04]
- SideEye Version: [e.g., 1.0.0]
- Node.js Version: [e.g., 16.14.0]
- Python Version: [e.g., 3.9.0]

## Additional Context

Screenshots, logs, or other relevant information
```

### Feature Requests

```markdown
## Feature Description

Clear description of the proposed feature

## Use Case

Why is this feature needed?

## Proposed Solution

How should this feature work?

## Alternatives Considered

Other approaches you've considered

## Additional Context

Any other relevant information
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Development Process

1. **Create Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**

   - Write code following project standards
   - Add tests for new functionality
   - Update documentation

3. **Test Changes**

   ```bash
   npm test
   npm run dev  # Manual testing
   ```

4. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Review Process

1. **Automated Checks**: CI/CD runs automated tests
2. **Maintainer Review**: Core maintainers review the code
3. **Community Review**: Community members may provide feedback
4. **Approval**: At least one maintainer approval required
5. **Merge**: Maintainer merges the PR

## Testing

### Running Tests

```bash
# Frontend tests
npm test

# Backend tests
cd backend && python manage.py test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Writing Tests

#### Frontend Tests (Jest/React Testing Library)

```javascript
import { render, screen } from "@testing-library/react";
import { Dashboard } from "../Dashboard";

test("renders dashboard with emotion display", () => {
  render(<Dashboard />);
  expect(screen.getByText("Current Emotion")).toBeInTheDocument();
});
```

#### Backend Tests (Django TestCase)

```python
from django.test import TestCase
from api.models import EmotionReading

class EmotionReadingTestCase(TestCase):
    def test_emotion_reading_creation(self):
        reading = EmotionReading.objects.create(
            emotions={'happy': 0.8},
            energy_level=0.7
        )
        self.assertEqual(reading.energy_level, 0.7)
```

### Test Coverage

- Aim for 80%+ test coverage
- Focus on critical functionality
- Include edge cases and error conditions
- Test both happy path and error scenarios

## Documentation

### Types of Documentation

1. **Code Documentation**: JSDoc, docstrings, inline comments
2. **API Documentation**: Endpoint descriptions and examples
3. **User Documentation**: User guides and tutorials
4. **Developer Documentation**: Setup and contribution guides

### Documentation Standards

- Use clear, concise language
- Include code examples
- Keep documentation up-to-date with code changes
- Use proper markdown formatting
- Include screenshots for UI features

### Building Documentation

```bash
# Generate API documentation
npm run docs:api

# Build user guide
npm run docs:build

# Serve documentation locally
npm run docs:serve
```

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Release notes prepared
- [ ] Cross-platform testing completed

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Discord**: Real-time chat with community
- **Email**: Direct contact with maintainers

### Resources

- [User Guide](docs/USER_GUIDE.md)
- [API Documentation](backend/api/README.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

## Recognition

Contributors are recognized in:

- README.md contributors section
- Release notes
- GitHub contributors page
- Annual contributor highlights

Thank you for contributing to SideEye Workspace! 🎉
